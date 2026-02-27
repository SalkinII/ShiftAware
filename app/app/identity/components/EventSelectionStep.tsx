"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface EventSelectionStepProps {
  memberId: string;
  onEventSelected: (eventId: string) => void;
  onBack: () => void;
}

export function EventSelectionStep({
  memberId,
  onEventSelected,
  onBack,
}: EventSelectionStepProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    fetchRegisteredEvents();
    fetchAllEvents();
  }, [memberId]);

  async function fetchRegisteredEvents() {
    try {
      const res = await fetch(`/api/members/${memberId}`);
      if (res.ok) {
        const data = await res.json();
        const memberData = data.data;
        const registrations = memberData?.eventRegistrations || [];
        const registeredEvents = registrations
          .filter((r: any) => r.event)
          .map((r: any) => r.event);
        setEvents(registeredEvents);

        // Auto-forward only on first visit, not when user navigated back
        const autoForwardKey = `shiftaware:eventAutoForward:${memberId}`;
        if (registeredEvents.length === 1 && !sessionStorage.getItem(autoForwardKey)) {
          sessionStorage.setItem(autoForwardKey, "done");
          onEventSelected(registeredEvents[0].id);
        }
      } else {
        console.error("Failed to fetch member:", res.status);
      }
    } catch (error) {
      console.error("Failed to fetch registered events:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllEvents() {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setAllEvents(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch all events:", error);
    }
  }

  const handleRegisterForEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      if (res.ok) {
        onEventSelected(eventId);
      } else {
        const error = await res.json();
        alert(error.message || "Failed to register for event");
      }
    } catch (error) {
      console.error("Failed to register for event:", error);
      alert("Failed to register for event");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const availableEvents = allEvents.filter(
    (event) => !events.find((e) => e.id === event.id),
  );

  if (loading) {
    return (
      <Card className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Select Your Event
          </h1>
          <p className="text-gray-500">Choose which event you want to view</p>
        </div>
      </div>

      {events.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Registered Events
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {events.map((event) => (
              <Card
                key={event.id}
                className="p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] hover:border-primary-300"
                onClick={() => onEventSelected(event.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{event.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(event.startDate)} -{" "}
                      {formatDate(event.endDate)}
                    </p>
                    <span
                      className={cn(
                        "inline-block text-xs font-semibold px-2 py-1 rounded mt-1",
                        event.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : event.status === "PLANNING"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700",
                      )}
                    >
                      {event.status}
                    </span>
                  </div>
                  <CheckCircle className="w-6 h-6 text-primary-600" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && !showAllEvents && (
        <Card className="p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Events Found
          </h3>
          <p className="text-gray-500 mb-6">
            You haven't registered for any events yet.
          </p>
          <Button variant="primary" onClick={() => setShowAllEvents(true)}>
            Browse Available Events
          </Button>
        </Card>
      )}

      {(showAllEvents || (events.length > 0 && availableEvents.length > 0)) && (
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Available Events
            </h2>
            {events.length > 0 && showAllEvents && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllEvents(false)}
              >
                Hide
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4">
            {availableEvents.map((event) => (
              <Card
                key={event.id}
                className="p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] hover:border-primary-300 border-2 border-dashed"
                onClick={() => handleRegisterForEvent(event.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{event.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(event.startDate)} -{" "}
                      {formatDate(event.endDate)}
                    </p>
                    <span
                      className={cn(
                        "inline-block text-xs font-semibold px-2 py-1 rounded mt-1",
                        event.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : event.status === "PLANNING"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700",
                      )}
                    >
                      {event.status}
                    </span>
                  </div>
                  <span className="text-sm text-primary-600 font-medium">
                    Register →
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
