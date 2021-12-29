import { createAPI } from '@iannisz/node-api-kit'
import { getBestLines, startAnalysing, stopAnalysing } from './routes.js'

const PORT = +process.argv[2] || 3000
export const api = createAPI(PORT)

api.post('/start-analysing', startAnalysing)
api.post('/stop-analysing', stopAnalysing)
api.post('/get-best-lines', getBestLines)