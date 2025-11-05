/**
 * Template Library Component
 *
 * Browse and apply pre-built SAI script templates.
 * Filter by category, difficulty, and search query.
 */

'use client';

import React, { useState } from 'react';
import { SAITemplate, TemplateCategory } from '@/lib/sai-unified/types';
import { SAI_TEMPLATE_LIBRARY, instantiateTemplate, searchTemplates, getTemplatesByCategory } from '@/lib/sai-unified/templates';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Play, Star, TrendingUp, Swords, MessageSquare, Target, MapPin, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface TemplateLibraryProps {
  onApplyTemplate: (template: SAITemplate, placeholders: Record<string, any>) => void;
  className?: string;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  onApplyTemplate,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<SAITemplate | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, any>>({});

  // Filter templates
  const filteredTemplates = searchQuery
    ? searchTemplates(searchQuery)
    : selectedCategory === 'all'
    ? SAI_TEMPLATE_LIBRARY
    : getTemplatesByCategory(selectedCategory);

  // Get category icon
  const getCategoryIcon = (category: TemplateCategory) => {
    switch (category) {
      case 'combat':
        return <Swords className="h-4 w-4" />;
      case 'boss':
        return <Star className="h-4 w-4" />;
      case 'dialogue':
        return <MessageSquare className="h-4 w-4" />;
      case 'quest':
        return <Target className="h-4 w-4" />;
      case 'movement':
        return <MapPin className="h-4 w-4" />;
      case 'summon':
        return <Zap className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Get difficulty badge
  const getDifficultyBadge = (difficulty: number) => {
    if (difficulty <= 1) {
      return <Badge variant="outline" className="text-green-600 border-green-600">Basic</Badge>;
    } else if (difficulty <= 2) {
      return <Badge variant="outline" className="text-blue-600 border-blue-600">Intermediate</Badge>;
    } else if (difficulty <= 3) {
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Advanced</Badge>;
    } else {
      return <Badge variant="outline" className="text-red-600 border-red-600">Expert</Badge>;
    }
  };

  // Render template card
  const renderTemplateCard = (template: SAITemplate) => (
    <Card
      key={template.id}
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => setSelectedTemplate(template)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {getCategoryIcon(template.category)}
              {template.name}
            </CardTitle>
            <CardDescription className="mt-1">{template.description}</CardDescription>
          </div>
          {getDifficultyBadge(template.difficulty || 1)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {template.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{template.script.nodes?.length || 0} nodes</span>
        {template.author && <span>by {template.author}</span>}
      </CardFooter>
    </Card>
  );

  // Handle apply template
  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;

    // Fill in default values for any missing placeholders
    const finalValues = { ...placeholderValues };
    selectedTemplate.placeholders?.forEach((placeholder) => {
      if (!(placeholder.label in finalValues) && placeholder.defaultValue !== undefined) {
        finalValues[placeholder.label] = placeholder.defaultValue;
      }
    });

    onApplyTemplate(selectedTemplate, finalValues);
    setSelectedTemplate(null);
    setPlaceholderValues({});
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Template Library</CardTitle>
          <CardDescription>
            Choose from {SAI_TEMPLATE_LIBRARY.length} pre-built templates
          </CardDescription>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={selectedCategory} onValueChange={(val) => setSelectedCategory(val as any)}>
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="combat" className="text-xs">Combat</TabsTrigger>
              <TabsTrigger value="boss" className="text-xs">Boss</TabsTrigger>
              <TabsTrigger value="quest" className="text-xs">Quest</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTemplates.length === 0 ? (
                  <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center">
                    <Search className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No templates found
                    </p>
                  </div>
                ) : (
                  filteredTemplates.map(renderTemplateCard)
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      {/* Template Configuration Dialog */}
      <Dialog open={selectedTemplate !== null} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate && getCategoryIcon(selectedTemplate.category)}
              {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              {/* Template Info */}
              <div className="flex items-center gap-2">
                {getDifficultyBadge(selectedTemplate.difficulty || 1)}
                <Badge variant="secondary">
                  {selectedTemplate.script.nodes?.length || 0} nodes
                </Badge>
                <Badge variant="outline">{selectedTemplate.category}</Badge>
              </div>

              {/* Placeholders */}
              {selectedTemplate.placeholders && selectedTemplate.placeholders.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Configuration</h4>
                  {selectedTemplate.placeholders.map((placeholder) => (
                    <div key={placeholder.label} className="space-y-2">
                      <Label htmlFor={`placeholder-${placeholder.label}`}>
                        {placeholder.label}
                      </Label>
                      <Input
                        id={`placeholder-${placeholder.label}`}
                        type="number"
                        placeholder={String(placeholder.defaultValue || 0)}
                        value={placeholderValues[placeholder.label] || ''}
                        onChange={(e) =>
                          setPlaceholderValues({
                            ...placeholderValues,
                            [placeholder.label]: Number(e.target.value),
                          })
                        }
                      />
                      {placeholder.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {placeholder.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={handleApplyTemplate}>
              <Play className="h-4 w-4 mr-2" />
              Apply Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TemplateLibrary;
