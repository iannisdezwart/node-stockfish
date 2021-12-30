# Node Stockfish

This is a Node.js wrapper around the [Stockfish](https://stockfishchess.org/)
chess engine. It can be used to analyse chess positions and get the best
lines of play.

## Installation

A quick `npm i` should do the trick.
This will install the necessary node modules, compile the TypeScript code,
clone the latest Stockfish source code and compile it.

## Usage

```js
import { StockfishInstance } from './index.js'

// Create a Stockfish instance.

const engine = StockfishInstance.getInstance()

// Set the starting position by providing a string of UCI moves.

engine.setBoardstateByMoves('e2e4 e7e5 b1c3')

// We can also set the starting position by providing a FEN string.

engine.setBoardstateByMoves('rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 0 1')

// Start anaylsing the position.

engine.startAnalysing({
	// Number of lines to include in the analysis.
	lines: 5
})

// Listen for analysis updates.

engine.onAnalysisData(analysisData =>
{
	console.log(`Analysis for depth ${ analysisData.depth }:`)

	for (const line of analysisData.lines)
	{
		console.log(`\t${ line.score }: ${ line.moves.join(' ') }`)
	}

	console.log('')

	if (analysisData.depth >= 15)
	{
		// Stop the analysis and terminate the Stockfish instance.

		engine.terminate()
	}
})
```