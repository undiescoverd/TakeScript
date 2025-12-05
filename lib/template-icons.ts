import {
  BookOpen,
  Video,
  GraduationCap,
  MousePointer,
  FileText,
  Presentation,
  Users,
  Lightbulb,
  Target,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps template names and categories to appropriate icons
 */
export function getTemplateIcon(
  name: string,
  category?: string
): LucideIcon {
  const nameLower = name.toLowerCase();
  const categoryLower = category?.toLowerCase() || "";

  // Match by template name
  if (nameLower.includes("tutorial")) return BookOpen;
  if (nameLower.includes("demo")) return Video;
  if (nameLower.includes("training") || nameLower.includes("course")) return GraduationCap;
  if (nameLower.includes("walkthrough") || nameLower.includes("tour")) return MousePointer;
  if (nameLower.includes("presentation") || nameLower.includes("slide")) return Presentation;
  if (nameLower.includes("onboarding")) return Users;
  if (nameLower.includes("guide")) return Lightbulb;
  if (nameLower.includes("explainer") || nameLower.includes("overview")) return Target;

  // Match by category
  if (categoryLower.includes("educational") || categoryLower.includes("education")) return BookOpen;
  if (categoryLower.includes("marketing")) return Video;
  if (categoryLower.includes("training")) return GraduationCap;
  if (categoryLower.includes("onboarding")) return Users;
  if (categoryLower.includes("presentation")) return Presentation;

  // Default icon
  return FileText;
}

/**
 * Get icon color class based on template category
 */
export function getTemplateIconColor(category?: string): string {
  const categoryLower = category?.toLowerCase() || "";

  if (categoryLower.includes("educational") || categoryLower.includes("education")) {
    return "text-blue-600 dark:text-blue-400";
  }
  if (categoryLower.includes("marketing")) {
    return "text-purple-600 dark:text-purple-400";
  }
  if (categoryLower.includes("training")) {
    return "text-green-600 dark:text-green-400";
  }
  if (categoryLower.includes("onboarding")) {
    return "text-orange-600 dark:text-orange-400";
  }

  // Default color (uses theme primary)
  return "";
}
