"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Loader2 } from "lucide-react";
import { TemplateLibraryCard } from "./TemplateLibraryCard";
import { EditTemplateDialog } from "./EditTemplateDialog";
import { toast } from "sonner";

interface Template {
  _id: Id<"templates">;
  name: string;
  description?: string;
  content: string;
  userId?: Id<"users">;
  category?: string;
  isSystem: boolean;
  createdAt: number;
  lastUsedAt?: number;
}

interface TemplateLibraryProps {
  isActive?: boolean;
}

export function TemplateLibrary({ isActive = true }: TemplateLibraryProps) {
  const router = useRouter();
  // Only subscribe to query when tab is active - saves bandwidth
  const templates = useQuery(api.templates.list, isActive ? {} : "skip");
  const createScript = useMutation(api.scripts.create);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingTemplateId, setEditingTemplateId] = useState<Id<"templates"> | null>(null);

  // Extract unique categories from templates
  const categories = useMemo(() => {
    if (!templates) return [];
    const uniqueCategories = new Set<string>();
    templates.forEach((template: Template) => {
      if (template.category) {
        uniqueCategories.add(template.category);
      }
    });
    return Array.from(uniqueCategories).sort();
  }, [templates]);

  // Filter templates based on search query and category
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];

    return templates.filter((template: Template) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "uncategorized" && !template.category) ||
        template.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, categoryFilter]);

  // Separate user and system templates
  const userTemplates = useMemo(
    () => filteredTemplates.filter((t: Template) => !t.isSystem),
    [filteredTemplates]
  );

  const systemTemplates = useMemo(
    () => filteredTemplates.filter((t: Template) => t.isSystem),
    [filteredTemplates]
  );

  const handleUseTemplate = async (templateId: Id<"templates">) => {
    try {
      const scriptId = await createScript({
        title: "Untitled Script",
        templateId,
      });
      router.push(`/script/${scriptId}`);
      toast.success("Script created from template");
    } catch (error) {
      console.error("Failed to create script:", error);
      toast.error("Failed to create script");
    }
  };

  if (!templates) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* User Templates Section */}
      {userTemplates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">My Templates</h2>
              <p className="text-sm text-muted-foreground">
                Templates you've created ({userTemplates.length})
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userTemplates.map((template: Template) => (
              <TemplateLibraryCard
                key={template._id}
                templateId={template._id}
                name={template.name}
                description={template.description}
                category={template.category}
                isSystem={template.isSystem}
                createdAt={template.createdAt}
                lastUsedAt={template.lastUsedAt}
                onEdit={() => setEditingTemplateId(template._id)}
                onUse={() => handleUseTemplate(template._id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* System Templates Section */}
      {systemTemplates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">System Templates</h2>
              <p className="text-sm text-muted-foreground">
                Built-in templates for common use cases ({systemTemplates.length})
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systemTemplates.map((template: Template) => (
              <TemplateLibraryCard
                key={template._id}
                templateId={template._id}
                name={template.name}
                description={template.description}
                category={template.category}
                isSystem={template.isSystem}
                createdAt={template.createdAt}
                lastUsedAt={template.lastUsedAt}
                onUse={() => handleUseTemplate(template._id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
          <p className="text-lg font-medium">No templates found</p>
          <p className="text-sm text-muted-foreground">
            {searchQuery || categoryFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first template from a script"}
          </p>
        </div>
      )}

      {/* Edit Template Dialog */}
      {editingTemplateId && (
        <EditTemplateDialog
          templateId={editingTemplateId}
          open={!!editingTemplateId}
          onOpenChange={(open) => !open && setEditingTemplateId(null)}
        />
      )}
    </div>
  );
}
