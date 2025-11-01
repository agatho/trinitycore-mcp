"use client";

import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MCPTool } from "@/lib/mcp/client";

interface ParameterFormProps {
  tool: MCPTool;
  onExecute: (parameters: Record<string, any>) => void;
  isExecuting: boolean;
}

export function ParameterForm({ tool, onExecute, isExecuting }: ParameterFormProps) {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset parameters when tool changes
  useEffect(() => {
    setParameters({});
    setValidationErrors({});
  }, [tool.name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const errors: Record<string, string> = {};
    const requiredFields = tool.inputSchema.required || [];

    for (const field of requiredFields) {
      if (parameters[field] === undefined || parameters[field] === null || parameters[field] === "") {
        errors[field] = "This field is required";
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Clear validation errors
    setValidationErrors({});

    // Execute tool
    onExecute(parameters);
  };

  const updateParameter = (name: string, value: any) => {
    setParameters(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  };

  const renderField = (name: string, schema: any) => {
    const isRequired = tool.inputSchema.required?.includes(name);
    const hasError = !!validationErrors[name];

    // Enum field (select dropdown)
    if (schema.enum) {
      return (
        <div key={name} className="space-y-2">
          <Label htmlFor={name} className="text-slate-300">
            {name}
            {isRequired && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <Select
            value={parameters[name]?.toString() || schema.default?.toString() || ""}
            onValueChange={(value) => updateParameter(name, value)}
          >
            <SelectTrigger
              id={name}
              className={`bg-slate-900 border-slate-700 text-white ${
                hasError ? "border-red-500" : ""
              }`}
            >
              <SelectValue placeholder={`Select ${name}`} />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {schema.enum.map((option: string) => (
                <SelectItem
                  key={option}
                  value={option}
                  className="text-white hover:bg-slate-800"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">{schema.description}</p>
          {hasError && (
            <p className="text-xs text-red-400">{validationErrors[name]}</p>
          )}
        </div>
      );
    }

    // Number field
    if (schema.type === "number" || schema.type === "integer") {
      return (
        <div key={name} className="space-y-2">
          <Label htmlFor={name} className="text-slate-300">
            {name}
            {isRequired && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <Input
            id={name}
            type="number"
            value={parameters[name] ?? schema.default ?? ""}
            onChange={(e) => {
              const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
              updateParameter(name, value);
            }}
            placeholder={schema.description}
            className={`bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 ${
              hasError ? "border-red-500" : ""
            }`}
          />
          <p className="text-xs text-slate-500">{schema.description}</p>
          {hasError && (
            <p className="text-xs text-red-400">{validationErrors[name]}</p>
          )}
        </div>
      );
    }

    // Boolean field
    if (schema.type === "boolean") {
      return (
        <div key={name} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={name} className="text-slate-300">
              {name}
              {isRequired && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <Switch
              id={name}
              checked={parameters[name] ?? schema.default ?? false}
              onCheckedChange={(checked) => updateParameter(name, checked)}
            />
          </div>
          <p className="text-xs text-slate-500">{schema.description}</p>
          {hasError && (
            <p className="text-xs text-red-400">{validationErrors[name]}</p>
          )}
        </div>
      );
    }

    // Array field
    if (schema.type === "array") {
      return (
        <div key={name} className="space-y-2">
          <Label htmlFor={name} className="text-slate-300">
            {name}
            {isRequired && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <Input
            id={name}
            type="text"
            value={parameters[name] ? JSON.stringify(parameters[name]) : schema.default ? JSON.stringify(schema.default) : ""}
            onChange={(e) => {
              try {
                const value = e.target.value ? JSON.parse(e.target.value) : undefined;
                updateParameter(name, value);
              } catch {
                // Invalid JSON, keep as string for now
                updateParameter(name, e.target.value);
              }
            }}
            placeholder='["value1", "value2"]'
            className={`bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm ${
              hasError ? "border-red-500" : ""
            }`}
          />
          <p className="text-xs text-slate-500">{schema.description} (JSON array)</p>
          {hasError && (
            <p className="text-xs text-red-400">{validationErrors[name]}</p>
          )}
        </div>
      );
    }

    // String field (default)
    return (
      <div key={name} className="space-y-2">
        <Label htmlFor={name} className="text-slate-300">
          {name}
          {isRequired && <span className="text-red-400 ml-1">*</span>}
        </Label>
        <Input
          id={name}
          type="text"
          value={parameters[name] ?? schema.default ?? ""}
          onChange={(e) => updateParameter(name, e.target.value || undefined)}
          placeholder={schema.description}
          className={`bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 ${
            hasError ? "border-red-500" : ""
          }`}
        />
        <p className="text-xs text-slate-500">{schema.description}</p>
        {hasError && (
          <p className="text-xs text-red-400">{validationErrors[name]}</p>
        )}
      </div>
    );
  };

  const properties = tool.inputSchema.properties || {};
  const propertyEntries = Object.entries(properties);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {propertyEntries.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          This tool has no parameters
        </div>
      ) : (
        propertyEntries.map(([name, schema]) => renderField(name, schema))
      )}

      <Button
        type="submit"
        disabled={isExecuting}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
      >
        {isExecuting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Executing...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Execute Tool
          </>
        )}
      </Button>
    </form>
  );
}
