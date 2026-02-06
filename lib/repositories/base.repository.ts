import { Prisma } from "@prisma/client";

export class RepositoryError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export class BaseRepository {
  protected throwFormattedException(code: string, message: string): never {
    throw new RepositoryError(code, message);
  }

  protected handlePrismaError(
    error: unknown,
    defaultMessage: string,
  ): RepositoryError {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return new RepositoryError("NOT_FOUND", "Record not found");
      }
      if (error.code === "P2002") {
        return new RepositoryError("DUPLICATE", "Record already exists");
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return new RepositoryError("INVALID_DATA", error.message);
    }

    return new RepositoryError("DATABASE_ERROR", defaultMessage);
  }
}
