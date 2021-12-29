# Node Stockfish API

This is a Node.js REST API for the [Stockfish](https://stockfishchess.org/)
chess engine. It can be used to analyse chess positions and get the best
lines of play.

## Installation

A quick `npm i` should do the trick.
This will install the necessary node modules, compile the TypeScript code,
clone the latest Stockfish source code and compile it.

## Usage

`node index.js` will start the server.

## API Routes

### POST `/start-analysing`

This will spawn a new Stockfish process and start analysing the given position.

#### Input:

```ts
// Either "moves" or "fen" must be provided.

interface StartAnalysingRequest
{
	// A string that holds all the moves of the game.
	moves?: string

	// A FEN string that holds the current board state.
	fen?: string

	// The number of lines to search for.
	lines?: number
}
```

Examples:

```json
{
	"moves": "e2e4 e7e5 b2c3",
	"lines": 5
}
```

```json
{
	"fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 0 1",
	"lines": 3
}
```

#### Output:

```ts
interface StartAnalysingResponse
{
	// The ID of the analysis.
	// This ID is used to look up the analysis in future requests.
	id: string
}
```

Example:

```json
{
	"id": "5bb34cd19e7d4d9a428be281d413be66"
}
```

### POST `/stop-analysing`

Stops the analysis with the given ID.
The Stockfish process will be either terminated or made inactive.

#### Input:

```ts
interface StopAnalysisRequest
{
	// The ID of the analysis to stop.
	id: string
}
```

Example:

```json
{
	"id": "5bb34cd19e7d4d9a428be281d413be66"
}
```

#### Output:

Plain text.

```
The analysis has been stopped.
```

### POST `/get-best-lines`

Returns a list of the best lines found so far for the given position.

#### Input:

```ts
interface GetBestLinesRequest
{
	// The ID of the analysis to get the best lines for.
	id: string
}
```

Example:

```json
{
	"id": "5bb34cd19e7d4d9a428be281d413be66"
}
```

#### Output:

```ts
/**
 * Interface holding a processed analysed line from the Stockfish output.
 */
interface StockfishLine
{
	// The score for the line.
	score: StockfishScore

	// The next moves of the line.
	moves: string[]
}

interface GetBestLinesResponse
{
	// The depth of the analysis.
	depth: number

	// The best lines found in the analysis.
	bestLines: StockfishLine[]
}
```

Example:

```json
{
	"depth": 24,
	"bestLines": [
		{
			"score": {
				"score": 0.42,
				"type": "exact"
			},
			"moves": [
				"e2e4",
				"c7c5",
				...
			]
		},
		{
			"score": {
				"score": 0.41,
				"type": "exact"
			},
			"moves": [
				"d2d4",
				"d7d5",
				...
			]
		},
		...
	]
}
```