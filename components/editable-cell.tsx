"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Check, X, Edit3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface EditableCellProps {
  value: string
  type: "text" | "number" | "date" | "select"
  options?: string[]
  onSave: (value: string) => void
  className?: string
  /** When true, display value wraps instead of single-line truncate (long descriptions/categories). */
  noTruncate?: boolean
  /** Optional class for the select trigger (wrapped category/account label). */
  selectTriggerClassName?: string
}

export function EditableCell({
  value,
  type,
  options,
  onSave,
  className,
  noTruncate,
  selectTriggerClassName,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !(noTruncate && type === "text")) {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  if (isEditing) {
    if (type === "select" && options) {
      return (
        <div className="flex items-start gap-2 min-w-0 w-full">
          <Select value={editValue} onValueChange={setEditValue}>
            <SelectTrigger
              className={cn(
                "text-xs min-w-0 w-full",
                noTruncate &&
                  "[&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words h-auto min-h-8 py-1.5 items-start",
                selectTriggerClassName,
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={handleSave} className="shrink-0">
            <Check className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} className="shrink-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    if (noTruncate && type === "text") {
      return (
        <div className="flex items-start gap-2 min-w-0 w-full">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            rows={4}
            className={cn(
              "flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          />
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={handleSave}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 min-w-0">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="ghost" onClick={handleSave}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group cursor-pointer hover:bg-gray-100 dark:hover:bg-muted/80 rounded px-2 py-1 min-w-0 flex gap-2",
        noTruncate ? "items-start" : "items-center",
        className,
      )}
      onClick={() => setIsEditing(true)}
    >
      <span
        className={cn(
          "flex-1 min-w-0",
          noTruncate ? "whitespace-pre-wrap break-words text-left leading-snug" : "truncate",
        )}
      >
        {value}
      </span>
      <Edit3 className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity mt-0.5" />
    </div>
  )
}
