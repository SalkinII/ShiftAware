"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Download, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExportMyShifts() {
    setIsExporting(true);
    try {
      // Lazy load html2canvas on demand
      const html2canvas = (await import('html2canvas')).default;

      // Find the calendar element to export
      const calendarElement = document.querySelector('[data-export="my-shifts"]') as HTMLElement;
      if (!calendarElement) {
        alert('Please navigate to "My Shifts" view first');
        return;
      }

      const canvas = await html2canvas(calendarElement);

      // Add timestamp footer
      const timestamp = format(new Date(), 'dd.MM.yyyy HH:mm');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`Export: ${timestamp}`, 20, canvas.height - 20);
      }

      // Download PNG
      const link = document.createElement('a');
      link.download = `my-shifts-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export. Make sure you\'re on the calendar page.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportFullCalendar() {
    setIsExporting(true);
    try {
      // Lazy load html2canvas on demand
      const html2canvas = (await import('html2canvas')).default;

      // Find the calendar element to export
      const calendarElement = document.querySelector('[data-export="full-calendar"]') as HTMLElement;
      if (!calendarElement) {
        alert('Please navigate to "Full Schedule" view first');
        return;
      }

      const canvas = await html2canvas(calendarElement);

      // Add timestamp footer
      const timestamp = format(new Date(), 'dd.MM.yyyy HH:mm');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`Export: ${timestamp}`, 20, canvas.height - 20);
      }

      // Download PNG
      const link = document.createElement('a');
      link.download = `full-calendar-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export. Make sure you\'re on the calendar page.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Export Schedule
        </h1>
        <p className="text-gray-500 font-medium mt-1">
          Download your calendar as a PNG image
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <Card className="p-8 hover:shadow-lg transition-all">
          <ImageIcon className="w-12 h-12 text-primary-500 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Export My Shifts
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Download a list of your assigned shifts as a PNG image
          </p>
          <Button
            onClick={handleExportMyShifts}
            disabled={isExporting}
            variant="primary"
            className="w-full"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export My Shifts
              </>
            )}
          </Button>
        </Card>

        <Card className="p-8 hover:shadow-lg transition-all">
          <ImageIcon className="w-12 h-12 text-primary-500 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Export Full Calendar
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Download the complete schedule with all shifts as a PNG image
          </p>
          <Button
            onClick={handleExportFullCalendar}
            disabled={isExporting}
            variant="primary"
            className="w-full"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export Full Calendar
              </>
            )}
          </Button>
        </Card>
      </div>

      <Card className="p-6 bg-primary-50 border-primary-100 max-w-3xl">
        <div className="flex items-start gap-3">
          <ImageIcon className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-primary-900 mb-2">
              How to Export
            </h3>
            <ol className="text-xs text-primary-700 space-y-1.5 list-decimal list-inside">
              <li>Navigate to the Calendar page</li>
              <li>Switch to the view you want to export (My Shifts or Full Schedule)</li>
              <li>Return here and click the corresponding export button</li>
              <li>Your image will download with a timestamp footer</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}
