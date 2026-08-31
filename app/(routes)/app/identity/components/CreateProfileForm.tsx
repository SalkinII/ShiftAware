"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { AttributeValueField } from "@/components/features/Identity/AttributeValueField";
interface CreateProfileFormProps {
  onSubmit: (profileData: ProfileData) => void;
  defaultEventId?: string;
}

export interface ProfileData {
  alias: string;
  avatarId: string;
  capabilities: string[];
  eventId?: string;
  attributes?: Record<string, any>;
}

interface Event {
  id: string;
  name: string;
}

interface AttributeDefinition {
  id: string;
  name: string;
  label: string;
  type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT" | "TIME_CONSTRAINT";
  required: boolean;
  options?: string[];
}

export function CreateProfileForm({
  onSubmit,
  defaultEventId,
}: CreateProfileFormProps) {
  const [formData, setFormData] = useState<ProfileData>({
    alias: "",
    avatarId: "😊",
    capabilities: ["TEAM_MEMBER"],
    attributes: {},
    eventId: defaultEventId,
  });

  const [events, setEvents] = useState<Event[]>([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState<
    AttributeDefinition[]
  >([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (formData.eventId) {
      fetchEventAttributes(formData.eventId);
    } else {
      setAttributeDefinitions([]);
      setFormData((prev) => ({ ...prev, attributes: {} }));
    }
  }, [formData.eventId]);

  async function fetchEvents() {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  }

  async function fetchEventAttributes(eventId: string) {
    setLoadingAttributes(true);
    try {
      const res = await fetch(`/api/events/${eventId}/attributes`);
      if (res.ok) {
        const data = await res.json();
        setAttributeDefinitions(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch attribute definitions:", error);
    } finally {
      setLoadingAttributes(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleAttributeChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: value },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="alias"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Display Name (Alias)
        </label>
        <Input
          id="alias"
          type="text"
          value={formData.alias}
          onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
          placeholder="Enter your preferred name"
          required
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          This is how you'll appear in the shift calendar
        </p>
      </div>

      <EmojiPicker
        label="Avatar"
        value={formData.avatarId}
        onChange={(emoji) => setFormData({ ...formData, avatarId: emoji })}
      />

      <div>
        <label
          htmlFor="eventId"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Register for Event
        </label>
        <select
          id="eventId"
          value={formData.eventId || ""}
          onChange={(e) =>
            setFormData({ ...formData, eventId: e.target.value || undefined })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select an event (optional)</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      {formData.eventId && attributeDefinitions.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            Event-Specific Attributes
          </h3>
          {loadingAttributes ? (
            <div className="text-sm text-gray-500">Loading attributes...</div>
          ) : (
            attributeDefinitions.map((attr) => (
              <div key={attr.id}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {attr.label}
                  {attr.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <AttributeValueField
                  attr={attr}
                  value={formData.attributes?.[attr.name]}
                  onChange={(v) => handleAttributeChange(attr.name, v)}
                />
              </div>
            ))
          )}
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <Button type="submit" variant="primary" className="w-full">
          Create Profile
        </Button>
      </div>
    </form>
  );
}
