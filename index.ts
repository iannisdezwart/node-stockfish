import { exec, ChildProcess } from 'child_process'
import { randomBytes } from 'crypto'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * Interface holding the options that can be passed to the
 * StockfishInstance` constructor.
 */
export interface StockfishAnalysisOptions
{
	// The number of lines to search for.
	lines?: number
}

export type StockfishScoreType = 'exact' | 'mate' | 'lowerbound' | 'upperbound'

/**
 * Interface holding the elements for a score for a position.
 */
export class StockfishScore
{
	// The score for the analysis.
	score: number

	// Type of the score.
	type: StockfishScoreType

	constructor(score: number, type: StockfishScoreType)
	{
		this.score = score
		this.type = type
	}

	toString()
	{
		switch (this.type)
		{
			case 'exact':
			{
				return this.score
			}

			case 'mate':
			{
				return `mate in ${ this.score }`
			}

			case 'lowerbound':
			{
				return `>= ${ this.score }`
			}

			case 'upperbound':
			{
				return `<= ${ this.score }`
			}
		}
	}
}

/**
 * Interface holding a processed analysed line from the Stockfish output.
 */
export interface StockfishLine
{
	// The score for the line.
	score: StockfishScore

	// The next moves of the line.
	moves: string[]
}

/**
 * Interface holding a complete analysation of a given depth.
 */
export interface StockfishAnalysis
{
	// The depth of the analysis.
	depth: number

	// The lines of the analysis.
	lines: StockfishLine[]
}

const STOCKFISH_EXECUTABLE_PATH = dirname(fileURLToPath(import.meta.url))
	+ '/Stockfish/src/stockfish'

/**
 * Class representing a Stockfish instance.
 * Creates a Stockfish child process and communicates with it.
 */
export class StockfishInstance
{
	// A map of all currently used Stockfish instances.
	static usedInstances: Map<string, StockfishInstance> = new Map()

	// A map of all idle Stockfish instances.
	static idleInstances: Map<string, StockfishInstance> = new Map()
	static MAX_IDLE_INSTANCES = 4

	/**
	 * Get a Stockfish instance.
	 */
	static getInstance(): StockfishInstance
	{
		// If there are idle instances, return one of them.

		if (StockfishInstance.idleInstances.size > 0)
		{
			// Grab the first idle instance we get out of our hashmap iterator.

			const instance = StockfishInstance.idleInstances.values().next().value

			// Mark it as used.

			StockfishInstance.idleInstances.delete(instance.id)
			StockfishInstance.usedInstances.set(instance.id, instance)

			return instance
		}

		// If there are no idle instances, create a new one.

		const instance = new StockfishInstance()

		// Mark it as used.

		StockfishInstance.usedInstances.set(instance.id, instance)

		return instance
	}

	// The ID of the stockfish instance.
	id: string

	// A reference to the child process.
	instance: ChildProcess

	// The best lines found in the current analysis.
	bestLines: Map<number, StockfishLine[]>

	// The current depth of the analysis.
	currentDepth: number

	// The options of the current analysis.
	analysisOptions: StockfishAnalysisOptions

	// Listener functions for the Stockfish instance.
	analysisListeners: ((analysis: StockfishAnalysis) => void)[]

	// The state of the Stockfish instance.
	state: 'stopping' | 'ready' | 'terminated'

	// Flag indicating whether the Stockfish instance has already been
	// started in the past. This is used to determine whether to set
	// the instance in a stopping state or not.
	// This is used to prevent the instance from not emitting any data
	// if it is stopped before the first start command is issued.
	hasStarted = false

	// Flag indicating whose turn it is. This is used to convert the
	// score to always be in white's perspective.
	turn: 'white' | 'black'

	/**
	 * Initialises this Stockfish instance and spawns a Stockfish process.
	 */
	constructor()
	{
		this.initialise()
	}

	/**
	 * Initialises this Stockfish instance and spawns a Stockfish process.
	 */
	initialise()
	{
		// Initialise fields.

		this.id = randomBytes(16).toString('hex')
		this.instance = exec(STOCKFISH_EXECUTABLE_PATH)

		this.reset()

		// Add the instance to the idle instances map.

		StockfishInstance.idleInstances.set(this.id, this)

		// Handle the output of the Stockfish process.

		this.instance.stdout.on('data', (chunk: string) =>
		{
			this.process(chunk)
		})

		// Handle early termination of the Stockfish process.

		this.instance.on('exit', (code: number) =>
		{
			if (this.state == 'terminated')
			{
				return
			}

			console.warn(`Stockfish process exited early with code ${ code }, restarting...`)
			this.initialise()
		})

		// Put the stockfish instance in UCI mode.

		this.instance.stdin.write('uci\n')
		this.instance.stdin.write('ucinewgame\n')
		this.state = 'ready'
	}

	/**
	 * Resets the analysis data.
	 */
	reset()
	{
		this.bestLines = new Map()
		this.currentDepth = 0
		this.analysisListeners = []
	}

	/**
	 * Sets the board state of the Stockfish instance to a given FEN string.
	 */
	setBoardstateByFen(fen: string)
	{
		this.instance.stdin.write(`position fen ${ fen }\n`)
		this.turn = fen.split(' ')[1] == 'w' ? 'white' : 'black'
	}

	/**
	 * Sets the board state of the Stockfish instance to a given string of
	 * space-seperated moves.
	 */
	setBoardstateByMoves(moves: string)
	{
		this.instance.stdin.write(`position startpos moves ${ moves }\n`)
		this.turn = moves.split(' ').length % 2 ? 'black' : 'white'
	}

	/**
	 * Starts the analysis of the current board state.
	 */
	startAnalysing(options: StockfishAnalysisOptions)
	{
		this.hasStarted = true

		// Reset the analysis data.

		this.reset()

		// Pass options to the stockfish instance.

		if (options.lines == null)
		{
			options.lines = 1
		}

		this.instance.stdin.write(`setoption name MultiPV value ${ options.lines }\n`)

		// Save the options and start the analysis.

		this.analysisOptions = options
		this.instance.stdin.write('go infinite\n')
	}

	/**
	 * Stops the analysis of the current board state.
	 */
	stopAnalysing()
	{
		if (!this.hasStarted)
		{
			return
		}

		// Stop the analysis.

		this.instance.stdin.write('stop\n')

		// Set the state to stopping.

		this.state = 'stopping'
	}

	/**
	 * Mark a Stockfish instance as idle.
	 */
	stopUsing()
	{
		// Mark this instance as not being used.

		StockfishInstance.usedInstances.delete(this.id)

		// Check if we have too many idle instances.

		if (StockfishInstance.idleInstances.size == StockfishInstance.MAX_IDLE_INSTANCES)
		{
			// We have too many idle instances.
			// We will discard this instance.

			this.terminate()
			return
		}

		// There aren't too many idle instances.
		// We will mark this instance as idle.

		StockfishInstance.idleInstances.set(this.id, this)
	}

	/**
	 * Processes a chunk of output from the Stockfish process.
	 */
	process(chunk: string)
	{
		const lines = chunk
			.split('\n')
			.filter(line => line.trim().length > 0)

		for (const line of lines)
		{
			if (line.startsWith('bestmove'))
			{
				// The analysis has finished.
				// Set the state to ready.

				this.state = 'ready'
			}

			if (this.state != 'ready')
			{
				// The previous analysis has not finished yet.
				// We will ignore this line.

				continue
			}

			if (line.startsWith('info'))
			{
				if (line.includes('pv'))
				{
					// The line holds analysis data.

					this.processInfo(line)
				}
				else if (line.includes('currmove')
					|| line.includes('NNUE evaluation'))
				{
					// The line holds rubbish data.
					// We will ignore it.

					continue
				}
				else
				{
					// This line could not be processed.
					// We will ignore it, but log it
					// for debugging purposes.

					console.log('[ not processed ]:')
					console.log(line)
				}
			}

		}
	}

	/**
	 * Processes an info line from the Stockfish process.
	 */
	processInfo(line: string)
	{
		// Parse the depth of the stockfish output.

		const depthIndexBegin = line.indexOf(' depth ') + 7
		const depthIndexEnd = line.indexOf(' ', depthIndexBegin)
		const depth = +line.substring(depthIndexBegin, depthIndexEnd)

		// Parse the line number of the stockfish output.

		const lineNumberIndexBegin = line.indexOf(' multipv ') + 9
		const lineNumberIndexEnd = line.indexOf(' ', lineNumberIndexBegin)
		const lineNumber = +line.substring(lineNumberIndexBegin, lineNumberIndexEnd)

		// Parse the score of the stockfish output.

		const scoreTypeIndexBegin = line.indexOf(' score ') + 7
		const scoreTypeIndexEnd = line.indexOf(' ', scoreTypeIndexBegin)
		const scoreType = line.substring(scoreTypeIndexBegin, scoreTypeIndexEnd)

		const scoreIndexBegin = scoreTypeIndexEnd + 1
		const scoreIndexEnd = line.indexOf(' ', scoreIndexBegin)

		let score: StockfishScore

		if (scoreType == 'cp')
		{
			score = new StockfishScore(
				+line.substring(scoreIndexBegin, scoreIndexEnd) / 100,
				'exact')
		}
		else if (scoreType == 'mate')
		{
			score = new StockfishScore(
				+line.substring(scoreIndexBegin, scoreIndexEnd),
				'mate')
		}
		else if (scoreType == 'lowerbound')
		{
			score = new StockfishScore(
				+line.substring(scoreIndexBegin, scoreIndexEnd) / 100,
				'lowerbound')
		}
		else if (scoreType == 'upperbound')
		{
			score = new StockfishScore(
				+line.substring(scoreIndexBegin, scoreIndexEnd) / 100,
				'upperbound')
		}
		else
		{
			throw new Error(`Unknown score type: ${ scoreType }`)
		}

		if (this.turn == 'black')
		{
			// Convert the score to white's perspective.

			score.score *= -1
		}

		// Parse the moves of the stockfish output.

		const movesIndexBegin = line.indexOf(' pv ') + 4
		const moves = line.substring(movesIndexBegin).split(' ')

		// Add the line to the best lines.

		if (!this.bestLines.has(depth))
		{
			this.bestLines.set(depth, [])
		}

		const linesOfCurrentDepth = this.bestLines.get(depth)

		linesOfCurrentDepth[lineNumber - 1] = { score, moves }

		const numLinesOfCurrentDepth = linesOfCurrentDepth
			.filter(line => line != null).length

		// Fire the analysis listeners if the analysis of this depth
		// is completed.

		const analysisComplete = numLinesOfCurrentDepth == this.analysisOptions.lines
			|| depth > 1 && numLinesOfCurrentDepth == this.bestLines.get(1).length

		if (analysisComplete)
		{
			this.analysisListeners.forEach(listener =>
			{
				listener({
					depth: depth,
					lines: linesOfCurrentDepth
				})
			})
		}

		// Update the current depth if necessary.

		if (analysisComplete && depth > this.currentDepth)
		{
			this.currentDepth = depth
		}
	}

	/**
	 * Returns the best lines analysed so far.
	 */
	getCurrentBestLines(): StockfishAnalysis
	{
		return {
			depth: this.currentDepth,
			lines: this.bestLines.get(this.currentDepth)
		}
	}

	/**
	 * Attaches a listener to the Stockfish instance.
	 * This listener will be called when the Stockfish instance
	 * produces analysis data.
	 */
	onAnalysisData(listener: (analysis: StockfishAnalysis) => void)
	{
		this.analysisListeners.push(listener)
	}

	/**
	 * Kills the Stockfish instance.
	 */
	terminate()
	{
		this.instance.kill()
		this.state = 'terminated'
	}
}