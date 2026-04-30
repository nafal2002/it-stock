import { useState, useRef, type ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Upload, Image as ImageIcon, Star, Check, Crop, RefreshCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface ImageUploadProps {
  itemId?: string;
  onImagesChange: (images: { url: string; is_primary: boolean; file?: File }[]) => void;
  existingImages?: { id?: string; url: string; is_primary: boolean }[];
}

export function ImageUpload({ itemId, onImagesChange, existingImages = [] }: ImageUploadProps) {
  const [images, setImages] = useState<{ id?: string; url: string; is_primary: boolean; file?: File }[]>(
    existingImages.map(img => ({ ...img, is_primary: !!img.is_primary }))
  );
  const [uploading, setUploading] = useState(false);
  const [cropImg, setCropImg] = useState<{ index: number; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Canvas toBlob failed"));
            },
            "image/webp",
            0.8
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter(file => {
      const isValid = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
      if (!isValid) toast.error(`File ${file.name} bukan format gambar yang didukung (JPG, PNG, WebP)`);
      return isValid;
    });

    setUploading(true);
    const newImages = [...images];

    for (const file of validFiles) {
      try {
        const compressedBlob = await compressImage(file);
        const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, ".webp"), {
          type: "image/webp",
        });

        const url = URL.createObjectURL(compressedFile);
        newImages.push({
          url,
          is_primary: newImages.length === 0,
          file: compressedFile
        });
      } catch (error) {
        console.error("Compression error:", error);
        toast.error(`Gagal memproses gambar ${file.name}`);
      }
    }

    setImages(newImages);
    onImagesChange(newImages);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    const removed = newImages.splice(index, 1)[0];
    
    if (removed.is_primary && newImages.length > 0) {
      newImages[0].is_primary = true;
    }
    
    setImages(newImages);
    onImagesChange(newImages);
  };

  const setPrimary = (index: number) => {
    const newImages = images.map((img: { id?: string; url: string; is_primary: boolean; file?: File }, i: number) => ({
      ...img,
      is_primary: i === index
    }));
    setImages(newImages);
    onImagesChange(newImages);
  };

  const handleCropSave = (index: number, newUrl: string, newFile: File) => {
    const newImages = [...images];
    newImages[index] = {
      ...newImages[index],
      url: newUrl,
      file: newFile
    };
    setImages(newImages);
    onImagesChange(newImages);
    setCropImg(null);
    toast.success("Gambar berhasil dipotong dan diperbarui");
  };

  return (
    <div className="space-y-4">
      <Label>Gambar Produk</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((img: { id?: string; url: string; is_primary: boolean; file?: File }, index: number) => (
          <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
            <img src={img.url} alt={`Product ${index}`} className="w-full h-full object-cover" />
            
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button 
                type="button" 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setPrimary(index)}
                title="Jadikan gambar utama"
              >
                {img.is_primary ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <Star className="h-4 w-4" />}
              </Button>
              <Button 
                type="button" 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setCropImg({ index, url: img.url })}
                title="Potong / Resize"
              >
                <Crop className="h-4 w-4" />
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => removeImage(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {img.is_primary && (
              <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <Check className="h-3 w-3" /> Utama
              </div>
            )}
          </div>
        ))}
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 hover:bg-accent transition-colors text-muted-foreground",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          ) : (
            <>
              <Upload className="h-6 w-6" />
              <span className="text-xs font-medium">Tambah Gambar</span>
            </>
          )}
        </button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />
      <p className="text-[10px] text-muted-foreground">
        Mendukung JPEG, PNG, WebP. Maksimal 5MB per file. Gambar akan dikompresi otomatis.
      </p>

      {cropImg && (
        <CropDialog 
          url={cropImg.url} 
          onClose={() => setCropImg(null)} 
          onSave={(newUrl, newFile) => handleCropSave(cropImg.index, newUrl, newFile)} 
        />
      )}
    </div>
  );
}

function CropDialog({ url, onClose, onSave }: { url: string; onClose: () => void; onSave: (url: string, file: File) => void }) {
  const [ratio, setRatio] = useState<string>("1:1");
  const [zoom, setZoom] = useState([100]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
  }, [url, ratio, zoom]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size based on ratio
    let targetWidth = 800;
    let targetHeight = 800;

    if (ratio === "4:3") targetHeight = 600;
    else if (ratio === "16:9") targetHeight = 450;
    else if (ratio === "3:4") { targetWidth = 600; targetHeight = 800; }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const z = zoom[0] / 100;
    
    // Calculate scaling to fill canvas (cover)
    const imgRatio = img.width / img.height;
    const canvasRatio = targetWidth / targetHeight;
    
    let drawWidth, drawHeight;
    if (imgRatio > canvasRatio) {
      drawHeight = targetHeight * z;
      drawWidth = drawHeight * imgRatio;
    } else {
      drawWidth = targetWidth * z;
      drawHeight = drawWidth / imgRatio;
    }

    const x = (targetWidth - drawWidth) / 2;
    const y = (targetHeight - drawHeight) / 2;

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob: Blob | null) => {
      if (blob) {
        const file = new File([blob], "cropped-image.webp", { type: "image/webp" });
        const newUrl = URL.createObjectURL(file);
        onSave(newUrl, file);
      }
    }, "image/webp", 0.9);
  };

  return (
    <Dialog open={true} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Potong & Resize Gambar</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex justify-center bg-muted rounded-lg overflow-hidden border p-4">
            <canvas 
              ref={canvasRef} 
              className="max-w-full max-h-[400px] object-contain shadow-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-muted-foreground">Aspek Rasio</Label>
              <Select value={ratio} onValueChange={setRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1 (Persegi)</SelectItem>
                  <SelectItem value="4:3">4:3 (Landscape)</SelectItem>
                  <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                  <SelectItem value="3:4">3:4 (Portrait)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs uppercase font-mono text-muted-foreground">Zoom</Label>
                <span className="text-xs font-mono">{zoom}%</span>
              </div>
              <Slider 
                value={zoom} 
                onValueChange={setZoom} 
                min={100} 
                max={300} 
                step={1}
                className="py-4"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary-glow">
            <Save className="h-4 w-4 mr-2" /> Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
