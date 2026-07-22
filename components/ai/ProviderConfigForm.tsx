"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  OPENROUTER_MODELS,
  OPENAI_MODEL_SUGGESTIONS,
  ANTHROPIC_MODEL_SUGGESTIONS,
} from "@/lib/ai-models";

type Provider = "openrouter" | "openai" | "anthropic" | "custom";
type Scope = "user" | "org";

const PROVIDER_LABELS: Record<Provider, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
  custom: "Custom (OpenAI-compatible)",
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openrouter: OPENROUTER_MODELS[0].id,
  openai: OPENAI_MODEL_SUGGESTIONS[0],
  anthropic: ANTHROPIC_MODEL_SUGGESTIONS[0],
  custom: "",
};

interface MaskedConfig {
  provider: string;
  baseUrl?: string;
  model: string;
  keyLast4: string;
}

interface Props {
  scope: Scope;
  config: MaskedConfig | null | undefined;
  disabled?: boolean;
}

export function ProviderConfigForm({ scope, config, disabled = false }: Props) {
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState(DEFAULT_MODELS.openrouter);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const saveConfig = useAction(api.aiProviders.saveConfig);
  const testProviderKey = useAction(api.aiProviders.testProviderKey);
  const removeConfig = useMutation(api.aiProviders.removeConfig);

  useEffect(() => {
    if (config) {
      setProvider(config.provider as Provider);
      setBaseUrl(config.baseUrl ?? "");
      setModel(config.model);
      setApiKey("");
    }
  }, [config]);

  const handleProviderChange = (value: Provider) => {
    setProvider(value);
    // Keep the saved model when switching back to the saved provider
    setModel(
      config && config.provider === value ? config.model : DEFAULT_MODELS[value]
    );
    if (value !== "custom") setBaseUrl("");
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = apiKey.trim()
        ? await testProviderKey({
            provider,
            apiKey: apiKey.trim(),
            baseUrl: provider === "custom" ? baseUrl.trim() : undefined,
          })
        : await testProviderKey({ scope });

      if (result.ok) {
        toast.success("Key is valid");
      } else {
        toast.error(result.error ?? "Key test failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Key test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config && !apiKey.trim()) {
      toast.error("Enter an API key");
      return;
    }
    if (!model.trim()) {
      toast.error("Enter a model");
      return;
    }

    setSaving(true);
    try {
      await saveConfig({
        scope,
        provider,
        apiKey: apiKey.trim() || undefined,
        baseUrl: provider === "custom" ? baseUrl.trim() : undefined,
        model: model.trim(),
      });
      setApiKey("");
      toast.success(
        scope === "org" ? "Organization AI provider saved" : "Personal AI provider saved"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeConfig({ scope });
      setProvider("openrouter");
      setApiKey("");
      setBaseUrl("");
      setModel(DEFAULT_MODELS.openrouter);
      toast.success("Provider removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove provider");
    } finally {
      setRemoving(false);
    }
  };

  const modelSuggestions =
    provider === "openai"
      ? OPENAI_MODEL_SUGGESTIONS
      : provider === "anthropic"
      ? ANTHROPIC_MODEL_SUGGESTIONS
      : [];
  const modelListId = `model-suggestions-${scope}`;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`provider-${scope}`}>Provider</Label>
        <Select
          value={provider}
          onValueChange={(value) => handleProviderChange(value as Provider)}
          disabled={disabled}
        >
          <SelectTrigger id={`provider-${scope}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PROVIDER_LABELS) as Provider[]).map((id) => (
              <SelectItem key={id} value={id}>
                {PROVIDER_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor={`api-key-${scope}`}>API Key</Label>
        <Input
          id={`api-key-${scope}`}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            config
              ? `Saved key ending in ••••${config.keyLast4} — enter new key to replace`
              : "sk-..."
          }
          disabled={disabled}
          autoComplete="off"
        />
      </div>

      {provider === "custom" && (
        <div>
          <Label htmlFor={`base-url-${scope}`}>Base URL</Label>
          <Input
            id={`base-url-${scope}`}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.groq.com/openai/v1"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Any OpenAI-compatible endpoint. Must be https:// and reachable from
            the cloud &mdash; e.g. Groq&apos;s https://api.groq.com/openai/v1, or a
            local Ollama exposed via a tunnel (ngrok, cloudflared, Tailscale).
          </p>
        </div>
      )}

      <div>
        <Label htmlFor={`model-${scope}`}>Model</Label>
        {provider === "openrouter" ? (
          <Select value={model} onValueChange={setModel} disabled={disabled}>
            <SelectTrigger id={`model-${scope}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPENROUTER_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <Input
              id={`model-${scope}`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === "custom" ? "llama3.1" : "Model name"}
              disabled={disabled}
              list={modelSuggestions.length > 0 ? modelListId : undefined}
            />
            {modelSuggestions.length > 0 && (
              <datalist id={modelListId}>
                {modelSuggestions.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={disabled || testing || (!apiKey.trim() && !config)}
        >
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Key
        </Button>
        <Button onClick={handleSave} disabled={disabled || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        {config && (
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={disabled || removing}
          >
            {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
