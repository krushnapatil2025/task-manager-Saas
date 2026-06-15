import { supabase } from "./supabaseClient";

/**
 * Upload an image file directly to Supabase storage from client side.
 * @param {File} imageFile 
 * @returns {Promise<{ imageUrl: string }>}
 */
const UploadImage = async (imageFile) => {
    try {
        const ext = imageFile.name.split('.').pop();
        const filename = `avatars/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

        const { data, error } = await supabase.storage
            .from("task-attachments")
            .upload(filename, imageFile, {
                cacheControl: "3600",
                upsert: false
            });

        if (error) {
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from("task-attachments")
            .getPublicUrl(filename);

        return { imageUrl: publicUrl };
    } catch (error) {
        console.error("Error uploading image to Supabase:", error);
        return { imageUrl: "" };
    }
};

export default UploadImage;