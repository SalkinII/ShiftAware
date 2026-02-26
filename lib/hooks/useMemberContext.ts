// lib/hooks/useMemberContext.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { unwrapApiResponse } from "@/lib/api-errors";
import { invalidateIdentity } from "@/lib/cache/invalidateIdentity";

interface Member {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  isAdmin: boolean;
}

interface MemberContextState {
  selectedMemberId: string | null;
  selectedMember: Member | null;
  loading: boolean;
  setSelectedMemberId: (id: string | null) => void;
  refreshMember: () => Promise<void>;
}

const STORAGE_KEY = "selectedMemberId";

export function useMemberContext(): MemberContextState {
  const [selectedMemberId, setSelectedMemberIdState] = useState<string | null>(
    null,
  );
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const setSelectedMemberId = useCallback((id: string | null) => {
    setSelectedMemberIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    invalidateIdentity();
  }, []);

  const refreshMember = useCallback(async () => {
    const id = selectedMemberId || localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setSelectedMember(null);
      return;
    }

    try {
      const res = await fetch(`/api/members/${id}`);
      if (res.ok) {
        const data = await res.json();
        const member = unwrapApiResponse<Member>(data);
        setSelectedMember(member);
      }
    } catch (error) {
      console.error("Failed to load member:", error);
    }
  }, [selectedMemberId]);

  // Restore selection on mount
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      setSelectedMemberIdState(savedId);
    }
    setLoading(false);
  }, []);

  // Load member details when ID changes
  useEffect(() => {
    if (selectedMemberId) {
      refreshMember();
    } else {
      setSelectedMember(null);
    }
  }, [selectedMemberId, refreshMember]);

  return {
    selectedMemberId,
    selectedMember,
    loading,
    setSelectedMemberId,
    refreshMember,
  };
}
