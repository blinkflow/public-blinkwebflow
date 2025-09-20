import log, {
  LogLevelNumbers,
  MethodFactory,
  Logger,
	LogLevelNames,
} from "loglevel";

export const logger: Logger = log.noConflict();

const originalFactory: MethodFactory = logger.methodFactory;

logger.methodFactory = function (
  methodName: LogLevelNames,
  logLevel: LogLevelNumbers,
  loggerName: string | symbol
) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName);
  return function (...args: unknown[]) {
    rawMethod("[Blink]", ...args);
  };
};

logger.setLevel(logger.getLevel());
