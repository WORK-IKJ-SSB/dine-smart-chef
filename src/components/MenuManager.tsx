import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, Sparkles, Trash2, ImageIcon, Loader2, Plus, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { parseMenuImage, generateDishImage } from "@/lib/menu-ai.functions";
import { money } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const CATEGORIES = ["Starter", "Main", "Dessert", "Drink", "Side"];

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
  const itemImgRef = useRef<HTMLInputElement>(null);
  const perItemImgRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; price: string; category: string; imageDataUrl: string | null }>({
    name: "", price: "", category: "Main", imageDataUrl: null,
  });
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
    if (!confirm("Remove this menu item?")) return;
    const { error, data } = await supabase.from("menu_items").delete().eq("id", id).select();
    if (error) {
      console.error("delete menu_items failed", error);
      return toast.error(error.message);
    }
    if (!data || data.length === 0) {
      return toast.error("Nothing was deleted (item not found).");
    }
    toast.success("Item removed");
    qc.invalidateQueries({ queryKey: ["menu-all"] });
    qc.invalidateQueries({ queryKey: ["menu"] });
  }

  async function addManually() {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name) return toast.error("Name is required");
    if (isNaN(price) || price < 0) return toast.error("Enter a valid price");
    setAdding(true);
    try {
      const { error } = await supabase.from("menu_items").insert({
        name, price, category: form.category, image_url: form.imageDataUrl,
      });
      if (error) throw error;
      toast.success(`Added ${name}`);
      setForm({ name: "", price: "", category: form.category, imageDataUrl: null });
      if (itemImgRef.current) itemImgRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["menu-all"] });
      qc.invalidateQueries({ queryKey: ["menu"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function uploadImageFor(itemId: string, file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const { error } = await supabase.from("menu_items").update({ image_url: dataUrl }).eq("id", itemId);
      if (error) throw error;
      toast.success("Image updated");
      qc.invalidateQueries({ queryKey: ["menu-all"] });
      qc.invalidateQueries({ queryKey: ["menu"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to upload image");
    } finally {
      if (perItemImgRef.current) perItemImgRef.current.value = "";
      setUploadTargetId(null);
    }
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
        <div className="space-y-5">
          {CATEGORIES.filter(c => items.some(i => i.category === c)).concat(
            [...new Set(items.map(i => i.category))].filter(c => !CATEGORIES.includes(c))
          ).map((cat) => (
            <div key={cat}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
              <ul className="grid sm:grid-cols-2 gap-3">
              {items.filter(i => i.category === cat).map((it) => (
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
                <p className="text-xs text-muted-foreground">{it.category} · {money(it.price)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => generateFor(it)}
                    disabled={generatingId === it.id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {generatingId === it.id
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                      : <><Sparkles className="h-3 w-3" /> {it.image_url ? "Regenerate" : "Generate image"}</>}
                  </button>
                  <button
                    onClick={() => { setUploadTargetId(it.id); perItemImgRef.current?.click(); }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    <ImagePlus className="h-3 w-3" /> Upload
                  </button>
                  <button onClick={() => remove(it.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            </li>
              ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <input
        ref={perItemImgRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && uploadTargetId) uploadImageFor(uploadTargetId, f);
        }}
      />

      <div className="mt-6 pt-6 border-t border-border">
        <h4 className="font-serif text-base font-semibold mb-3">Add item manually</h4>
        <div className="grid sm:grid-cols-[1fr_120px_140px_auto] gap-2 items-start">
          <Input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Price ₹" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <input
              ref={itemImgRef} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setForm((p) => ({ ...p, imageDataUrl: null }));
                if (f) {
                  const url = await fileToDataUrl(f);
                  setForm((p) => ({ ...p, imageDataUrl: url }));
                }
              }}
            />
            <Button type="button" variant="outline" onClick={() => itemImgRef.current?.click()} title="Attach image">
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button type="button" onClick={addManually} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {form.imageDataUrl && (
          <img src={form.imageDataUrl} alt="" className="mt-2 h-16 w-16 rounded-md object-cover" />
        )}
      </div>
    </Card>
  );
}