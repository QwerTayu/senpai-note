"use client";
import { Icon as Iconify, type IconifyIcon } from "@iconify/react";
import add from "@iconify-icons/material-symbols/add";
import calendarMonth from "@iconify-icons/material-symbols/calendar-month-outline";
import check from "@iconify-icons/material-symbols/check";
import checkCircle from "@iconify-icons/material-symbols/check-circle-outline";
import close from "@iconify-icons/material-symbols/close";
import contactSupport from "@iconify-icons/material-symbols/contact-support-outline";
import deleteIcon from "@iconify-icons/material-symbols/delete-outline";
import description from "@iconify-icons/material-symbols/description-outline";
import editCalendar from "@iconify-icons/material-symbols/edit-calendar-outline";
import editNote from "@iconify-icons/material-symbols/edit-note-outline";
import errorIcon from "@iconify-icons/material-symbols/error-outline";
import expandMore from "@iconify-icons/material-symbols/expand-more";
import help from "@iconify-icons/material-symbols/help-outline";
import inbox from "@iconify-icons/material-symbols/inbox-outline";
import inkPen from "@iconify-icons/material-symbols/ink-pen-outline";
import moveToInbox from "@iconify-icons/material-symbols/move-to-inbox-outline";
import school from "@iconify-icons/material-symbols/school-outline";
import smartToy from "@iconify-icons/material-symbols/smart-toy-outline";
import today from "@iconify-icons/material-symbols/today-outline";
import work from "@iconify-icons/material-symbols/work-outline";

// アイコンは Material Symbols（outline）だけを使い、世界観をそろえる。使うものだけをここで読み込む
const ICONS = {
  add,
  calendar: calendarMonth,
  check,
  checkCircle,
  close,
  question: contactSupport,
  delete: deleteIcon,
  source: description,
  editDate: editCalendar,
  editNote,
  error: errorIcon,
  expand: expandMore,
  help,
  inbox,
  pen: inkPen,
  ingest: moveToInbox,
  school,
  agent: smartToy,
  today,
  work,
} satisfies Record<string, IconifyIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className = "", label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <Iconify
      icon={ICONS[name]}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
