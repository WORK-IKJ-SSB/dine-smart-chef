import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, Sparkles, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseMenuImage, generateDishImage } from "@/lib/menu-ai.functions";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function MenuManager() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const parse = useServerFn(parseMenuImage);
  const genImg = useServerFn(generateDishImage);

  const { data: items = [] } = useQuery({
    queryKey: ["menu-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items").select("*").order("category").order("name");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { items: parsed } = await parse({ data: { imageDataUrl: dataUrl } });
      if (parsed.length === 0) {
        toast.error("Couldn't read any dishes from that image.");
        return;
      }
      const rows = parsed.map((p) => ({
        name: p.name, price: Number(p.price) || 0, category: p.category || "Main",
      }));
      const { error } = await supabase.from("menu_items").insert(rows);
      if (error) throw error;
      toast.success(`Added ${rows.length} item${rows.length > 1 ? "s" : ""} from the menu photo.`);
      qc.invalidateQueries({ queryKey: ["menu-all"] });
      qc.invalidateQueries({ queryKey: ["menu"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to parse menu");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function generateFor(it: MenuItem) {
    setGeneratingId(it.id);
    try {
      const { dataUrl } = await genImg({ data: { name: it.name } });
      const { error } = await supabase.from("menu_items").update({ image_url: dataUrl }).eq("id", it.id);
      if (error) throw error;
      toast.success(`Image generated for ${it.name}`);
      qc.invalidateQueries({ queryKey: ["menu-all"] });
      qc.invalidateQueries({ queryKey: ["menu"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate image");
    } finally {
      setGeneratingId(null);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["menu-all"] });
    qc.invalidateQueries({ queryKey: ["menu"] });
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-lg font-semibold">Menu</h3>
          <p className="text-sm text-muted-foreground">Upload or snap a photo of your paper menu — AI extracts every dish.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Button variant="outline" disabled={parsing} onClick={() => cameraRef.current?.click()}>
            <Camera className="h-4 w-4 mr-2" /> Snap
          </Button>
          <Button disabled={parsing} onClick={() => fileRef.current?.click()}>
            {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {parsing ? "Reading menu…" : "Upload"}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No items yet.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {items.map((it) => (
            <li key={it.id} className="flex gap-3 rounded-lg border border-border p-3 bg-background">
              <div className="h-16 w-16 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                {it.image_url ? (
                  <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{it.name}</p>
                <p className="text-xs text-muted-foreground">{it.category} · ${Number(it.price).toFixed(2)}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => generateFor(it)}
                    disabled={generatingId === it.id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {generatingId === it.id
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                      : <><Sparkles className="h-3 w-3" /> {it.image_url ? "Regenerate" : "Generate image"}</>}
                  </button>
                  <button onClick={() => remove(it.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}