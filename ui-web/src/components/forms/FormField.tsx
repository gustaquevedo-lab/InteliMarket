import { type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react"

interface FormFieldProps {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}

export const FormField = ({ label, required, error, hint, children, className = "" }: FormFieldProps) => (
  <div className={className}>
    {label && (
      <label className="input-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
)

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ className = "", error, ...props }, ref) => (
    <input
      ref={ref}
      className={`input-field ${error ? "border-red-500 focus:ring-red-500" : ""} ${className}`}
      {...props}
    />
  )
)
FormInput.displayName = "FormInput"

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ className = "", error, children, ...props }, ref) => (
    <select
      ref={ref}
      className={`input-field ${error ? "border-red-500 focus:ring-red-500" : ""} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
)
FormSelect.displayName = "FormSelect"

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className = "", error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={`input-field min-h-[80px] resize-y ${error ? "border-red-500 focus:ring-red-500" : ""} ${className}`}
      {...props}
    />
  )
)
FormTextarea.displayName = "FormTextarea"

interface FormRowProps {
  children: ReactNode
  cols?: number
  className?: string
}

export const FormRow = ({ children, cols = 2, className = "" }: FormRowProps) => (
  <div className={`grid grid-cols-${cols} gap-4 ${className}`}>
    {children}
  </div>
)

interface FormActionsProps {
  children: ReactNode
  className?: string
}

export const FormActions = ({ children, className = "" }: FormActionsProps) => (
  <div className={`flex gap-3 pt-2 ${className}`}>
    {children}
  </div>
)
