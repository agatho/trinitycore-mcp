/**
 * Talk Action Editor Component
 *
 * Specialized editor for SMART_ACTION_TALK (ID: 1).
 * Provides an intuitive UI for creature speech with preview and validation.
 * Phase 4 Enhancement - Professional UX for common action.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageSquare,
  Volume2,
  Eye,
  Info,
  AlertTriangle,
  CheckCircle,
  Database,
  Type,
  Clock,
  User,
  Settings,
} from 'lucide-react';
import { SAIParameter } from '@/lib/sai-unified/types';

interface TalkActionEditorProps {
  parameters: SAIParameter[];
  onChange: (parameters: SAIParameter[]) => void;
}

// Talk types from creature_text.type
const TALK_TYPES = [
  { value: 0, label: 'Say', icon: MessageSquare, color: 'text-blue-500', description: 'Visible in chat within 100 yards' },
  { value: 1, label: 'Yell', icon: Volume2, color: 'text-red-500', description: 'Visible in chat within 300 yards' },
  { value: 2, label: 'Text Emote', icon: Eye, color: 'text-yellow-500', description: 'Creature performs an emote' },
  { value: 3, label: 'Boss Emote', icon: Volume2, color: 'text-purple-500', description: 'Zone-wide emote' },
  { value: 4, label: 'Whisper', icon: User, color: 'text-green-500', description: 'Private message to player' },
  { value: 5, label: 'Boss Whisper', icon: User, color: 'text-purple-500', description: 'Zone-wide whisper' },
];

export const TalkActionEditor: React.FC<TalkActionEditorProps> = ({ parameters, onChange }) => {
  const [mode, setMode] = useState<'textid' | 'direct'>('textid');
  const [directText, setDirectText] = useState('');
  const [talkType, setTalkType] = useState(0);
  const [duration, setDuration] = useState(0);
  const [useTalkTarget, setUseTalkTarget] = useState(false);

  // Extract current values from parameters
  useEffect(() => {
    const textIdParam = parameters.find(p => p.name === 'TextID' || p.name === 'GroupID');
    const textParam = parameters.find(p => p.name === 'TextString');
    const durationParam = parameters.find(p => p.name === 'Duration');
    const targetParam = parameters.find(p => p.name === 'UseTalkTarget');

    if (textParam && textParam.value) {
      setMode('direct');
      setDirectText(textParam.value as string);
    }

    if (durationParam) {
      setDuration(durationParam.value as number || 0);
    }

    if (targetParam) {
      setUseTalkTarget((targetParam.value as number) === 1);
    }
  }, [parameters]);

  // Get current TextID parameter
  const textIdParam = parameters.find(p => p.name === 'TextID' || p.name === 'GroupID');
  const textId = textIdParam ? (textIdParam.value as number) : 0;

  // Update parameters when values change
  const updateParameters = (updates: Partial<{
    textId: number;
    textString: string;
    duration: number;
    useTalkTarget: boolean;
  }>) => {
    const newParams = [...parameters];

    if (updates.textId !== undefined) {
      const param = newParams.find(p => p.name === 'TextID' || p.name === 'GroupID');
      if (param) param.value = updates.textId;
    }

    if (updates.textString !== undefined) {
      let param = newParams.find(p => p.name === 'TextString');
      if (!param) {
        // Add TextString parameter if it doesn't exist
        param = {
          name: 'TextString',
          value: '',
          type: 'text',
          description: 'Direct text input',
          required: false,
        };
        newParams.push(param);
      }
      param.value = updates.textString;
    }

    if (updates.duration !== undefined) {
      let param = newParams.find(p => p.name === 'Duration');
      if (!param) {
        param = {
          name: 'Duration',
          value: 0,
          type: 'number',
          description: 'Duration text stays visible',
          units: 'ms',
          required: false,
        };
        newParams.push(param);
      }
      param.value = updates.duration;
    }

    if (updates.useTalkTarget !== undefined) {
      let param = newParams.find(p => p.name === 'UseTalkTarget');
      if (!param) {
        param = {
          name: 'UseTalkTarget',
          value: 0,
          type: 'enum',
          description: 'Use talk target from event',
          required: false,
        };
        newParams.push(param);
      }
      param.value = updates.useTalkTarget ? 1 : 0;
    }

    onChange(newParams);
  };

  // Get talk type info
  const currentTalkType = TALK_TYPES.find(t => t.value === talkType) || TALK_TYPES[0];
  const TalkIcon = currentTalkType.icon;

  // Character count and validation
  const charCount = directText.length;
  const isOverLimit = charCount > 1000;
  const hasText = mode === 'direct' ? charCount > 0 : textId > 0;

  return (
    <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/30 dark:via-gray-900 dark:to-blue-950/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <MessageSquare className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              Talk Action Editor
              {hasText && <CheckCircle className="w-4 h-4 text-green-500" />}
            </CardTitle>
            <CardDescription>
              Configure creature speech, yells, emotes, and whispers
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'textid' | 'direct')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="textid" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Use Text ID
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              Direct Input
            </TabsTrigger>
          </TabsList>

          {/* Text ID Mode */}
          <TabsContent value="textid" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="text-id" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Text ID (creature_text)
              </Label>
              <Input
                id="text-id"
                type="number"
                value={textId}
                onChange={(e) => updateParameters({ textId: parseInt(e.target.value) || 0 })}
                min={0}
                placeholder="Enter creature_text.groupid..."
                className="font-mono"
              />
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-blue-700 dark:text-blue-300 font-medium">
                    References creature_text table
                  </p>
                  <p className="text-blue-600/80 dark:text-blue-400/80 text-xs">
                    Text ID corresponds to creature_text.groupid for this creature.
                    The actual text, type, language, and sound are stored in the database.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Direct Text Mode */}
          <TabsContent value="direct" className="space-y-4 mt-4">
            {/* Talk Type Selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <TalkIcon className={`w-4 h-4 ${currentTalkType.color}`} />
                Speech Type
              </Label>
              <Select
                value={String(talkType)}
                onValueChange={(v) => setTalkType(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TALK_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={String(type.value)}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${type.color}`} />
                          <span className="font-medium">{type.label}</span>
                          <span className="text-xs text-gray-500">- {type.description}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Text Input */}
            <div className="space-y-2">
              <Label htmlFor="direct-text" className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Text Content
                </span>
                <Badge variant={isOverLimit ? 'destructive' : 'outline'} className="text-xs">
                  {charCount}/1000
                </Badge>
              </Label>
              <Textarea
                id="direct-text"
                value={directText}
                onChange={(e) => {
                  setDirectText(e.target.value);
                  updateParameters({ textString: e.target.value });
                }}
                placeholder={`Enter what the creature should ${currentTalkType.label.toLowerCase()}...\n\nExample for Say: "Intruders! Alert the guards!"\nExample for Yell: "You dare challenge me? Face my wrath!"\nExample for Emote: "laughs menacingly."`}
                className="min-h-[120px] resize-vertical font-sans"
                maxLength={1000}
              />
              {isOverLimit && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertTriangle className="w-4 h-4" />
                  Text exceeds maximum length of 1000 characters
                </div>
              )}
              {charCount > 0 && !isOverLimit && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  Text looks good ({charCount} characters)
                </div>
              )}
            </div>

            {/* Live Preview */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </Label>
              <Card className={`p-4 border-2 ${currentTalkType.color.replace('text-', 'border-')}/20`}>
                <div className="flex items-start gap-3">
                  <TalkIcon className={`w-5 h-5 ${currentTalkType.color}`} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={currentTalkType.color}>
                        {currentTalkType.label}
                      </Badge>
                      <span className="text-sm text-gray-500">Creature Name</span>
                    </div>
                    <p className="text-sm italic">
                      {directText || `No text entered yet. Start typing to see a preview of how the ${currentTalkType.label.toLowerCase()} will appear.`}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Common Options */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Additional Options
          </h4>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Display Duration (ms)
            </Label>
            <div className="flex gap-2">
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setDuration(val);
                  updateParameters({ duration: val });
                }}
                min={0}
                max={300000}
                step={1000}
                placeholder="0 (default)"
                className="flex-1"
              />
              <Badge variant="outline" className="self-center">
                {duration === 0 ? 'Default' : `${(duration / 1000).toFixed(1)}s`}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              How long the text stays visible (0 = default duration based on text length)
            </p>
          </div>

          {/* Use Talk Target */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <input
              type="checkbox"
              id="use-talk-target"
              checked={useTalkTarget}
              onChange={(e) => {
                setUseTalkTarget(e.target.checked);
                updateParameters({ useTalkTarget: e.target.checked });
              }}
              className="mt-1 w-4 h-4 rounded border-gray-300"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="use-talk-target" className="cursor-pointer flex items-center gap-2">
                <User className="w-4 h-4" />
                Use Talk Target from Event
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                If enabled, directs the speech to the player/creature that triggered the event
                (useful for whispers and contextual dialogue)
              </p>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
          <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Quick Tips
          </h5>
          <ul className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
            <li>• <strong>Say:</strong> Normal speech, heard by nearby players</li>
            <li>• <strong>Yell:</strong> Louder speech with wider range, use for warnings/combat</li>
            <li>• <strong>Emote:</strong> Creature actions like "*laughs*" or "*bows*"</li>
            <li>• <strong>Whisper:</strong> Private message to one player</li>
            <li>• Use Text ID mode for production (allows localization and sounds)</li>
            <li>• Use Direct Input for quick prototyping and testing</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default TalkActionEditor;
