export function logInfo(message, data = {}) {

  const log = {
    level: "INFO",
    time: new Date().toISOString(),
    message,
    ...data
  };

  console.log(JSON.stringify(log));

}

export function logError(message, data = {}) {

  const log = {
    level: "ERROR",
    time: new Date().toISOString(),
    message,
    ...data
  };

  console.error(JSON.stringify(log));

}