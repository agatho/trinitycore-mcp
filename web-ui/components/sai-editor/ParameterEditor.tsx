/**
 * Parameter Editor Component
 *
 * Type-aware parameter editing panel for SAI nodes.
 * Provides specialized inputs for different parameter types.
 */

'use client';

import React, { useState } from 'react';
import { SAIParameter } from '@/lib/sai-unified/types';
import { validateParameter } from '@/lib/sai-unified/parameters';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Info, MessageSquare } from 'lucide-react';

interface ParameterEditorProps {
  parameters: SAIParameter[];
  onChange: (parameters: SAIParameter[]) => void;
  title?: string;
  description?: string;
}

export const ParameterEditor: React.FC<ParameterEditorProps> = ({
  parameters,
  onChange,
  title = 'Parameters',
  description,
}) => {
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());
  const [textMode, setTextMode] = useState<Map<string, 'id' | 'direct'>>(new Map());
  const [directText, setDirectText] = useState<Map<string, string>>(new Map());

  const handleParameterChange = (index: number, value: number | string) => {
    const newParams = [...parameters];
    newParams[index] = { ...newParams[index], value };

    // Validate
    const error = validateParameter(newParams[index]);
    const newErrors = new Map(validationErrors);
    if (error) {
      newErrors.set(newParams[index].name, error);
    } else {
      newErrors.delete(newParams[index].name);
    }
    setValidationErrors(newErrors);

    onChange(newParams);
  };

  const renderParameterInput = (param: SAIParameter, index: number) => {
    const error = validationErrors.get(param.name);

    switch (param.type) {
      case 'enum':
        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`param-${index}`} className="text-sm font-medium">
                {param.name}
                {param.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {param.units && (
                <Badge variant="outline" className="text-xs">
                  {param.units}
                </Badge>
              )}
            </div>
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
            )}
            <Select
              value={String(param.value)}
              onValueChange={(val) => handleParameterChange(index, Number(val))}
            >
              <SelectTrigger id={`param-${index}`} className={error ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select option..." />
              </SelectTrigger>
              <SelectContent>
                {param.options?.map((opt) => (
                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                    {opt.description && (
                      <span className="text-xs text-gray-500 ml-2">({opt.description})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
          </div>
        );

      case 'flag':
        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`param-${index}`} className="text-sm font-medium">
                {param.name}
                {param.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Badge variant="outline" className="text-xs">
                Bitwise
              </Badge>
            </div>
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
            )}
            <Input
              id={`param-${index}`}
              type="number"
              value={param.value}
              onChange={(e) => handleParameterChange(index, Number(e.target.value))}
              className={error ? 'border-red-500' : ''}
              placeholder="0x00000000"
            />
            <p className="text-xs text-gray-500">
              Enter bitwise flags in decimal or hex format
            </p>
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
          </div>
        );

      case 'spell':
      case 'creature':
      case 'item':
      case 'quest':
      case 'gameobject':
        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`param-${index}`} className="text-sm font-medium">
                {param.name}
                {param.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Badge variant="secondary" className="text-xs">
                {param.type}
              </Badge>
            </div>
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
            )}
            <Input
              id={`param-${index}`}
              type="number"
              value={param.value}
              onChange={(e) => handleParameterChange(index, Number(e.target.value))}
              className={error ? 'border-red-500' : ''}
              min={param.min}
              max={param.max}
              placeholder={`${param.type} ID`}
            />
            {param.tooltip && (
              <div className="flex items-center gap-1 text-xs text-blue-500">
                <Info className="h-3 w-3" />
                {param.tooltip}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
          </div>
        );

      case 'text':
        const currentMode = textMode.get(param.name) || 'id';
        const currentText = directText.get(param.name) || '';

        return (
          <div key={index} className="space-y-3 border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {param.name}
                {param.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Badge variant="secondary" className="text-xs">
                text
              </Badge>
            </div>
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
            )}

            <Tabs
              value={currentMode}
              onValueChange={(val) => {
                const newMode = new Map(textMode);
                newMode.set(param.name, val as 'id' | 'direct');
                setTextMode(newMode);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="id">Text ID</TabsTrigger>
                <TabsTrigger value="direct">Direct Text</TabsTrigger>
              </TabsList>

              <TabsContent value="id" className="space-y-2">
                <Input
                  type="number"
                  value={param.value}
                  onChange={(e) => handleParameterChange(index, Number(e.target.value))}
                  className={error ? 'border-red-500' : ''}
                  placeholder="Text group ID from creature_text"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  References creature_text.groupid
                </p>
              </TabsContent>

              <TabsContent value="direct" className="space-y-2">
                <Textarea
                  value={currentText}
                  onChange={(e) => {
                    const newText = new Map(directText);
                    newText.set(param.name, e.target.value);
                    setDirectText(newText);
                  }}
                  placeholder="Enter the text the creature should say/yell/whisper..."
                  className="min-h-[100px] resize-y"
                  maxLength={1000}
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Direct text input (will be converted to creature_text entry)</span>
                  <span>{currentText.length}/1000</span>
                </div>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
          </div>
        );

      default:
        // Number type
        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`param-${index}`} className="text-sm font-medium">
                {param.name}
                {param.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {param.units && (
                <Badge variant="outline" className="text-xs">
                  {param.units}
                </Badge>
              )}
            </div>
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
            )}
            <Input
              id={`param-${index}`}
              type="number"
              value={param.value}
              onChange={(e) => handleParameterChange(index, Number(e.target.value))}
              className={error ? 'border-red-500' : ''}
              min={param.min}
              max={param.max}
              placeholder={param.defaultValue !== undefined ? String(param.defaultValue) : '0'}
            />
            {param.tooltip && (
              <div className="flex items-center gap-1 text-xs text-blue-500">
                <Info className="h-3 w-3" />
                {param.tooltip}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
          </div>
        );
    }
  };

  if (parameters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No parameters to configure
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {validationErrors.size > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-500 mt-2">
            <AlertCircle className="h-4 w-4" />
            {validationErrors.size} validation {validationErrors.size === 1 ? 'error' : 'errors'}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {parameters.map((param, index) => renderParameterInput(param, index))}
      </CardContent>
    </Card>
  );
};

export default ParameterEditor;
