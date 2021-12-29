import * as http from 'http'
import { readJSONBody } from '@iannisz/node-api-kit'
import { StockfishInstance, StockfishLine } from './stockfish.js'

export interface StartAnalysingRequest
{
	// A string that holds all the moves of the game.
	moves?: string

	// A FEN string that holds the current board state.
	fen?: string

	// The number of lines to search for.
	lines?: number
}

export interface StartAnalysingResponse
{
	// The ID of the analysis.
	// This ID is used to look up the analysis in future requests.
	id: string
}

export interface StopAnalysisRequest
{
	// The ID of the analysis to stop.
	id: string
}

export interface GetBestLinesRequest
{
	// The ID of the analysis to get the best lines for.
	id: string
}

export interface GetBestLinesResponse
{
	// The depth of the analysis.
	depth: number

	// The best lines found in the analysis.
	bestLines: StockfishLine[]
}

export const startAnalysing = async (
	req: http.IncomingMessage, res: http.ServerResponse) =>
{
	const body = await readJSONBody(req) as StartAnalysingRequest

	if (body.moves == null && body.fen == null)
	{
		res.statusCode = 400
		res.end('Missing "moves" or "fen" field in request body.')

		return
	}

	const stockfishInstance = StockfishInstance.getInstance()

	if (body.moves == null)
	{
		// Use the FEN string to set the board state.

		stockfishInstance.setBoardstateByFen(body.fen)
	}
	else
	{
		// Use the moves string to set the board state.

		stockfishInstance.setBoardstateByMoves(body.moves)
	}

	// Start analysing the board state.

	stockfishInstance.startAnalysing({
		lines: body.lines
	})

	const response: StartAnalysingResponse = {
		id: stockfishInstance.id
	}

	res.end(JSON.stringify(response))
}

export const stopAnalysing = async (
	req: http.IncomingMessage, res: http.ServerResponse) =>
{
	const body = await readJSONBody(req) as StopAnalysisRequest

	if (body.id == null)
	{
		res.statusCode = 400
		res.end('Missing "id" field in request body.')

		return
	}

	const stockfishInstance = StockfishInstance.usedInstances.get(body.id)

	if (stockfishInstance == null)
	{
		res.statusCode = 404
		res.end('No analysis with the given ID found.')

		return
	}

	stockfishInstance.stopAnalysing()
	stockfishInstance.stopUsing()

	res.end('The analysis has been stopped.')

	return
}

export const getBestLines = async (
	req: http.IncomingMessage, res: http.ServerResponse) =>
{
	const body = await readJSONBody(req) as GetBestLinesRequest

	if (body.id == null)
	{
		res.statusCode = 400
		res.end('Missing "id" field in request body.')

		return
	}

	const stockfishInstance = StockfishInstance.usedInstances.get(body.id)

	if (stockfishInstance == null)
	{
		res.statusCode = 404
		res.end('No analysis with the given ID found.')

		return
	}

	const response = stockfishInstance.getCurrentBestLines()

	res.end(JSON.stringify(response))
}