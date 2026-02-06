import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class TeamMemberRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const member = await prisma.teamMember.findUnique({
        where: { id },
      });

      if (!member) {
        this.throwFormattedException("NOT_FOUND", `Member ${id} not found`);
      }

      return member;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch member");
    }
  }

  async findAll(where?: Prisma.TeamMemberWhereInput) {
    try {
      return await prisma.teamMember.findMany({
        where,
        orderBy: { alias: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch members");
    }
  }

  async create(data: Prisma.TeamMemberCreateInput) {
    try {
      return await prisma.teamMember.create({ data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create member");
    }
  }

  async update(id: string, data: Prisma.TeamMemberUpdateInput) {
    try {
      return await prisma.teamMember.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update member");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.teamMember.delete({
        where: { id },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete member");
    }
  }
}
