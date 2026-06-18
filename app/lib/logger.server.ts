import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

function localTime() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return `,"time":"${ts}"`
}

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  timestamp: localTime,
  formatters: {
    level(label) {
      return { level: label }
    },
    bindings() {
      return {}
    }
  },
  transport: isProduction
    ? {
        target: 'pino/file',
        options: {
          destination: process.env.LOG_FILE || '/app/logs/app.log',
          mkdir: true
        }
      }
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' }
      }
})

export default logger
