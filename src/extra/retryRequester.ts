module Extra {
  export interface RetryRequesterParameters<T> {
    requester: Requester.FacetRequester<T>;
    delay: number;
    retry: number;
    retryOnTimeout: boolean;
  }

  export function retryRequester<T>(parameters: RetryRequesterParameters<T>): Requester.FacetRequester<T> {
    var requester = parameters.requester;
    var delay = parameters.delay || 500;
    var retry = parameters.retry || 3;
    var retryOnTimeout = parameters.retryOnTimeout;

    if (typeof delay !== "number") throw new TypeError("delay should be a number");
    if (typeof retry !== "number") throw new TypeError("retry should be a number");

    return (request: Requester.DatabaseRequest<T>): Q.Promise<any> => {
      var tries = 1;

      function handleError(err: Error): Q.Promise<any> {
        if (tries > retry) throw err;
        tries++;
        if (err.message === "timeout" && !retryOnTimeout) throw err;
        return Q.delay(delay).then(() => requester(request)).catch(handleError);
      }

      return requester(request).catch(handleError);
    };
  }
}
