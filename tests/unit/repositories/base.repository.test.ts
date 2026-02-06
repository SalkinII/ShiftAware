import { describe, it, expect } from "vitest";
import { BaseRepository, RepositoryError } from "@/lib/repositories/base.repository";
import { Prisma } from "@prisma/client";

// Test helper class to expose protected methods
class TestRepository extends BaseRepository {
  public testThrowFormattedException(code: string, message: string): never {
    return this.throwFormattedException(code, message);
  }

  public testHandlePrismaError(error: unknown, defaultMessage: string): RepositoryError {
    return this.handlePrismaError(error, defaultMessage);
  }
}

describe("BaseRepository", () => {
  it("should throw RepositoryError with code and message", () => {
    const repo = new TestRepository();

    expect(() => {
      repo.testThrowFormattedException("NOT_FOUND", "Record not found");
    }).toThrow("Record not found");

    try {
      repo.testThrowFormattedException("NOT_FOUND", "Record not found");
    } catch (error) {
      expect(error).toBeInstanceOf(RepositoryError);
      expect((error as RepositoryError).code).toBe("NOT_FOUND");
    }
  });

  it("should handle Prisma P2025 error (not found)", () => {
    const repo = new TestRepository();
    const prismaError = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "5.0.0",
    });

    const result = repo.testHandlePrismaError(prismaError, "Default message");

    expect(result).toBeInstanceOf(RepositoryError);
    expect(result.code).toBe("NOT_FOUND");
    expect(result.message).toBe("Record not found");
  });

  it("should handle Prisma P2002 error (duplicate)", () => {
    const repo = new TestRepository();
    const prismaError = new Prisma.PrismaClientKnownRequestError("Duplicate", {
      code: "P2002",
      clientVersion: "5.0.0",
    });

    const result = repo.testHandlePrismaError(prismaError, "Default message");

    expect(result).toBeInstanceOf(RepositoryError);
    expect(result.code).toBe("DUPLICATE");
  });

  it("should handle unknown errors with default message", () => {
    const repo = new TestRepository();
    const unknownError = new Error("Unknown error");

    const result = repo.testHandlePrismaError(unknownError, "Default message");

    expect(result).toBeInstanceOf(RepositoryError);
    expect(result.code).toBe("DATABASE_ERROR");
    expect(result.message).toBe("Default message");
  });
});
