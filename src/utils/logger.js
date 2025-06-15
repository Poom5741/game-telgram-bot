import winston from 'winston';

const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let log = `${timestamp} [${service || 'APP'}] ${level}: ${message}`;
        if (Object.keys(meta).length > 0) {
            log += ' ' + JSON.stringify(meta);
        }
        return log;
    })
);

export function createLogger(service = 'App') {
    return winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: logFormat,
        defaultMeta: { service },
        transports: [
            new winston.transports.Console({
                format: consoleFormat
            }),
            new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error'
            }),
            new winston.transports.File({
                filename: 'logs/combined.log'
            })
        ]
    });
}

export const logger = createLogger();