export class CliError extends Error {
  readonly code: string;

  constructor(message: string, code = "CLI_ERROR") {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}

export class HttpError extends Error {
  readonly status: number;
  readonly responseText: string;

  constructor(message: string, status: number, responseText: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.responseText = responseText;
  }
}
