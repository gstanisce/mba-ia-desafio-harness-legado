import { app } from './http/app'
import { config } from './config/env'

app.listen(config.port, () => {
  console.log(`API rodando em http://localhost:${config.port}`)
})
