'use client'

import { useState, useCallback } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface ImportDropzoneProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export function ImportDropzone({ onFilesSelected, disabled }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    )

    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
    }
  }, [disabled])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files) return

    const files = Array.from(e.target.files).filter(
      file => file.type === 'application/pdf'
    )

    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
    }
  }, [disabled])

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setSelectedFiles([])
  }

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="pdf-upload"
          disabled={disabled}
        />
        <label
          htmlFor="pdf-upload"
          className={cn(
            'flex flex-col items-center cursor-pointer',
            disabled && 'cursor-not-allowed'
          )}
        >
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">
            Drop PDF files here or click to browse
          </p>
          <p className="text-sm text-muted-foreground">
            Upload ADP pay stub PDFs (supports multiple files)
          </p>
        </label>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Selected Files ({selectedFiles.length})</h4>
            <Button variant="ghost" size="sm" onClick={clearFiles}>
              Clear All
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button onClick={handleUpload} className="w-full" disabled={disabled}>
            Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  )
}
