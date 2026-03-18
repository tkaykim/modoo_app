import { createClient } from './supabase-client';
import * as fabric from 'fabric';
import {
  extractTextObjectsToSVGAsync,
  extractImageUrlsFromCanvasState,
  type TextSvgExports,
} from './canvas-svg-export';
import { uploadSVGToStorage, uploadDataUrlToStorage } from './supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from './storage-config';
import { FontMetadata, deleteFonts } from './fontUtils';

export interface SaveDesignData {
  productId: string;
  title?: string;
  productColor: string;
  canvasState: Record<string, string>;
  userId?: string;
  previewImage?: string; // Base64 data URL for preview image
  pricePerItem: number;
  canvasMap?: Record<string, fabric.Canvas>; // Optional canvas instances for SVG export
  customFonts?: FontMetadata[]; // Custom fonts used in the design
}

export interface SavedDesign {
  id: string;
  user_id: string;
  product_id: string;
  title: string | null;
  color_selections: {
    productColor: string;
  };
  canvas_state: Record<string, string>;
  preview_url: string | null;
  image_urls?: Record<string, Array<{ url: string; path?: string; uploadedAt?: string }>>;
  text_svg_exports?: TextSvgExports; // SVG URLs per side
  custom_fonts?: FontMetadata[]; // Custom fonts used in the design
  created_at: string;
  updated_at: string;
}

/**
 * Save a design to Supabase
 * @param data The design data to save
 * @returns The saved design record or null if failed
 */
export async function saveDesign(data: SaveDesignData): Promise<SavedDesign | null> {
  const supabase = createClient();

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      throw new Error('User must be authenticated to save designs');
    }

    // Extract image URLs from canvas state for easier access
    const imageUrls = extractImageUrlsFromCanvasState(data.canvasState);

    // Export text objects to SVG using Fabric's toSVG() if canvas instances are provided
    const textSvgExports: TextSvgExports = {};
    if (data.canvasMap) {
      console.log('Exporting text objects to SVG using Fabric.js toSVG()...');
      console.log('Canvas map sides:', Object.keys(data.canvasMap));

      for (const [sideId, canvas] of Object.entries(data.canvasMap)) {
        try {
          console.log(`Processing side ${sideId}, canvas exists:`, !!canvas);
          console.log(`Canvas objects count:`, canvas?.getObjects?.()?.length ?? 'N/A');

          // Wait for fonts to load before extracting (ensures curved text becomes paths)
          // const { objectSvgs, textObjects } = await extractTextObjectsToSVGAsync(canvas);
          // console.log(`Side ${sideId}: Found ${textObjects.length} text objects, ${objectSvgs.length} SVGs generated`);

          // if (objectSvgs.length > 0) {
          //   const sideObjectUrls: Record<string, string> = {};
          //   const sidePngUrls: Record<string, string> = {};

          //   // Generate a unique design ID for filenames (will use actual ID after insert)
          //   const tempDesignId = `temp-${Date.now()}`;

          //   for (const objectSvg of objectSvgs) {
          //     // Upload SVG
          //     const svgFileName = `design-${tempDesignId}-${sideId}-${objectSvg.objectId}.svg`;
          //     const uploadResult = await uploadSVGToStorage(
          //       supabase,
          //       objectSvg.svg,
          //       STORAGE_BUCKETS.TEXT_EXPORTS,
          //       STORAGE_FOLDERS.SVG,
          //       svgFileName
          //     );

          //     if (uploadResult.success && uploadResult.url) {
          //       sideObjectUrls[objectSvg.objectId] = uploadResult.url;
          //     } else {
          //       console.error(`Failed to upload SVG for ${sideId}/${objectSvg.objectId}:`, uploadResult.error);
          //     }

          //     // Upload PNG (300 DPI, transparent background)
          //     if (objectSvg.pngDataUrl) {
          //       const pngFileName = `design-${tempDesignId}-${sideId}-${objectSvg.objectId}.png`;
          //       const pngUploadResult = await uploadDataUrlToStorage(
          //         supabase,
          //         objectSvg.pngDataUrl,
          //         STORAGE_BUCKETS.TEXT_EXPORTS,
          //         STORAGE_FOLDERS.SVG, // Using same folder for now
          //         pngFileName
          //       );

          //       if (pngUploadResult.success && pngUploadResult.url) {
          //         sidePngUrls[objectSvg.objectId] = pngUploadResult.url;
          //         console.log(`Uploaded 300 DPI PNG for ${sideId}/${objectSvg.objectId}: ${objectSvg.pngWidth}x${objectSvg.pngHeight}`);
          //       } else {
          //         console.error(`Failed to upload PNG for ${sideId}/${objectSvg.objectId}:`, pngUploadResult.error);
          //       }
          //     }
          //   }

          //   if (Object.keys(sideObjectUrls).length > 0) {
          //     if (!textSvgExports.__objects) {
          //       textSvgExports.__objects = {};
          //     }
          //     // Type assertion needed due to index signature in TextSvgExports
          //     const objectsMap = textSvgExports.__objects as Record<string, Record<string, string>>;
          //     objectsMap[sideId] = sideObjectUrls;
          //   }

          //   // Store PNG URLs separately under __pngs
          //   if (Object.keys(sidePngUrls).length > 0) {
          //     if (!textSvgExports.__pngs) {
          //       (textSvgExports as Record<string, unknown>).__pngs = {};
          //     }
          //     const pngsMap = (textSvgExports as Record<string, unknown>).__pngs as Record<string, Record<string, string>>;
          //     pngsMap[sideId] = sidePngUrls;
          //   }
          // }
        } catch (error) {
          console.error(`Error exporting SVG for side ${sideId}:`, error);
        }
      }
    }

    // Prepare the data for insertion
    const designData: any = {
      user_id: user.id,
      product_id: data.productId,
      title: data.title || `Design ${new Date().toLocaleString('ko-KR')}`,
      color_selections: {
        productColor: data.productColor,
      },
      canvas_state: data.canvasState,
      preview_url: data.previewImage || null, // Save preview image as base64 data URL
      image_urls: imageUrls, // Save extracted image URLs for easy access
      price_per_item: data.pricePerItem,
      custom_fonts: data.customFonts || [] // Save custom fonts metadata
    };

    // Add text SVG exports if available
    console.log('textSvgExports keys:', Object.keys(textSvgExports));
    console.log('textSvgExports content:', JSON.stringify(textSvgExports, null, 2));
    if (Object.keys(textSvgExports).length > 0) {
      designData.text_svg_exports = textSvgExports;
      console.log('Added text_svg_exports to designData');
    } else {
      console.log('No text_svg_exports to add (empty object)');
    }

    // Insert into saved_designs table
    const { data: savedDesign, error: insertError } = await supabase
      .from('saved_designs')
      .insert(designData)
      .select()
      .single();

    if (insertError) {
      console.error('Error saving design:', insertError);
      throw insertError;
    }

    return savedDesign;
  } catch (error) {
    console.error('Failed to save design:', error);
    return null;
  }
}

/**
 * Load a design from Supabase by ID
 * @param designId The ID of the design to load
 * @returns The design data or null if not found
 */
export async function loadDesign(designId: string): Promise<SavedDesign | null> {
  const supabase = createClient();

  try {
    const { data: design, error } = await supabase
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .single();

    if (error) {
      console.error('Error loading design:', error);
      throw error;
    }

    return design;
  } catch (error) {
    console.error('Failed to load design:', error);
    return null;
  }
}

/**
 * Get all saved designs for the current user
 * @returns Array of saved designs or empty array if failed
 */
export async function getUserDesigns(): Promise<SavedDesign[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return [];
    }

    const { data: designs, error } = await supabase
      .from('saved_designs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching designs:', error);
      throw error;
    }

    return designs || [];
  } catch (error) {
    console.error('Failed to fetch user designs:', error);
    return [];
  }
}

/**
 * Update an existing design
 * @param designId The ID of the design to update
 * @param data The updated design data
 * @returns The updated design or null if failed
 */
export async function updateDesign(
  designId: string,
  data: Partial<SaveDesignData>
): Promise<SavedDesign | null> {
  const supabase = createClient();

  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.productColor !== undefined) {
      updateData.color_selections = { productColor: data.productColor };
    }
    if (data.canvasState !== undefined) {
      updateData.canvas_state = data.canvasState;
      // Extract and update image URLs when canvas state changes
      updateData.image_urls = extractImageUrlsFromCanvasState(data.canvasState);
    }
    if (data.previewImage !== undefined) {
      updateData.preview_url = data.previewImage;
    }
    if (data.customFonts !== undefined) {
      updateData.custom_fonts = data.customFonts;
    }

    // Export text objects to SVG and PNG if canvas instances are provided
    if (data.canvasMap) {
      console.log('Exporting text objects to SVG/PNG for update...');

      const textSvgExports: TextSvgExports = {};

      for (const [sideId, canvas] of Object.entries(data.canvasMap)) {
        try {
          // Wait for fonts to load before extracting (ensures curved text becomes paths)
          const { objectSvgs } = await extractTextObjectsToSVGAsync(canvas);

          if (objectSvgs.length > 0) {
            const sideObjectUrls: Record<string, string> = {};
            const sidePngUrls: Record<string, string> = {};

            for (const objectSvg of objectSvgs) {
              // Upload SVG
              const svgFileName = `design-${designId}-${sideId}-${objectSvg.objectId}.svg`;
              const uploadResult = await uploadSVGToStorage(
                supabase,
                objectSvg.svg,
                STORAGE_BUCKETS.TEXT_EXPORTS,
                STORAGE_FOLDERS.SVG,
                svgFileName
              );

              if (uploadResult.success && uploadResult.url) {
                sideObjectUrls[objectSvg.objectId] = uploadResult.url;
              } else {
                console.error(`Failed to upload SVG for ${sideId}/${objectSvg.objectId}:`, uploadResult.error);
              }

              // Upload PNG (300 DPI, transparent background)
              if (objectSvg.pngDataUrl) {
                const pngFileName = `design-${designId}-${sideId}-${objectSvg.objectId}.png`;
                const pngUploadResult = await uploadDataUrlToStorage(
                  supabase,
                  objectSvg.pngDataUrl,
                  STORAGE_BUCKETS.TEXT_EXPORTS,
                  STORAGE_FOLDERS.SVG,
                  pngFileName
                );

                if (pngUploadResult.success && pngUploadResult.url) {
                  sidePngUrls[objectSvg.objectId] = pngUploadResult.url;
                  console.log(`Uploaded 300 DPI PNG for ${sideId}/${objectSvg.objectId}: ${objectSvg.pngWidth}x${objectSvg.pngHeight}`);
                } else {
                  console.error(`Failed to upload PNG for ${sideId}/${objectSvg.objectId}:`, pngUploadResult.error);
                }
              }
            }

            if (Object.keys(sideObjectUrls).length > 0) {
              if (!textSvgExports.__objects) {
                textSvgExports.__objects = {};
              }
              const objectsMap = textSvgExports.__objects as Record<string, Record<string, string>>;
              objectsMap[sideId] = sideObjectUrls;
            }

            // Store PNG URLs under __pngs
            if (Object.keys(sidePngUrls).length > 0) {
              if (!textSvgExports.__pngs) {
                textSvgExports.__pngs = {};
              }
              const pngsMap = textSvgExports.__pngs as Record<string, Record<string, string>>;
              pngsMap[sideId] = sidePngUrls;
            }
          }
        } catch (error) {
          console.error(`Error exporting SVG/PNG for side ${sideId}:`, error);
        }
      }

      // Add text SVG/PNG exports if available
      if (Object.keys(textSvgExports).length > 0) {
        updateData.text_svg_exports = textSvgExports;
      }
    }

    const { data: updatedDesign, error } = await supabase
      .from('saved_designs')
      .update(updateData)
      .eq('id', designId)
      .select()
      .single();

    if (error) {
      console.error('Error updating design:', error);
      throw error;
    }

    return updatedDesign;
  } catch (error) {
    console.error('Failed to update design:', error);
    return null;
  }
}

/**
 * Extract storage path from a Supabase storage URL
 * @param url The full storage URL
 * @param bucket The bucket name to extract path from
 * @returns The storage path or null if not found
 */
function extractStoragePath(url: string, bucket: string): string | null {
  try {
    // Match pattern: /storage/v1/object/public/{bucket}/{path}
    const regex = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Delete a design and its associated files (fonts, images, SVGs)
 * @param designId The ID of the design to delete
 * @returns true if successful, false otherwise
 */
export async function deleteDesign(designId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    // First, fetch the full design to get all associated files
    const { data: design, error: fetchError } = await supabase
      .from('saved_designs')
      .select('custom_fonts, image_urls, text_svg_exports')
      .eq('id', designId)
      .single();

    if (fetchError) {
      console.error('Error fetching design:', fetchError);
      throw fetchError;
    }

    // 1. Delete images from user-designs bucket
    const imageUrls = design?.image_urls as Record<string, Array<{ url: string; path?: string }>> | null;
    if (imageUrls) {
      const imagePaths: string[] = [];

      for (const sideImages of Object.values(imageUrls)) {
        for (const image of sideImages) {
          // Use the path property if available, otherwise extract from URL
          if (image.path) {
            imagePaths.push(image.path);
          } else if (image.url) {
            const extractedPath = extractStoragePath(image.url, STORAGE_BUCKETS.USER_DESIGNS);
            if (extractedPath) {
              imagePaths.push(extractedPath);
            }
          }
        }
      }

      if (imagePaths.length > 0) {
        console.log(`Deleting ${imagePaths.length} image files...`);
        const { error: imageDeleteError } = await supabase.storage
          .from(STORAGE_BUCKETS.USER_DESIGNS)
          .remove(imagePaths);

        if (imageDeleteError) {
          console.warn('Error deleting images:', imageDeleteError);
        }
      }
    }

    // 2. Delete SVG exports from text-exports bucket
    const textSvgExports = design?.text_svg_exports as TextSvgExports | null;
    if (textSvgExports?.__objects) {
      const svgPaths: string[] = [];

      for (const sideObjects of Object.values(textSvgExports.__objects)) {
        if (typeof sideObjects === 'object' && sideObjects !== null) {
          for (const svgUrl of Object.values(sideObjects as Record<string, string>)) {
            const extractedPath = extractStoragePath(svgUrl, STORAGE_BUCKETS.TEXT_EXPORTS);
            if (extractedPath) {
              svgPaths.push(extractedPath);
            }
          }
        }
      }

      if (svgPaths.length > 0) {
        console.log(`Deleting ${svgPaths.length} SVG files...`);
        const { error: svgDeleteError } = await supabase.storage
          .from(STORAGE_BUCKETS.TEXT_EXPORTS)
          .remove(svgPaths);

        if (svgDeleteError) {
          console.warn('Error deleting SVGs:', svgDeleteError);
        }
      }
    }

    // 3. Delete custom fonts (only if not used elsewhere)
    const customFonts = (design?.custom_fonts as FontMetadata[]) || [];

    if (customFonts.length > 0) {
      const fontPaths = customFonts.map(f => f.path);

      // Query order_items to see if any fonts are referenced
      const { data: orderItems, error: orderCheckError } = await supabase
        .from('order_items')
        .select('custom_fonts')
        .neq('design_id', designId); // Check orders NOT from this design

      if (orderCheckError) {
        console.warn('Error checking orders for font usage:', orderCheckError);
      } else {
        // Collect all font paths used in other orders
        const fontsInOrders = new Set<string>();
        orderItems?.forEach((item) => {
          const itemFonts = (item.custom_fonts as FontMetadata[]) || [];
          itemFonts.forEach((font) => {
            fontsInOrders.add(font.path);
          });
        });

        // Filter out fonts that are used in orders
        const fontsToDelete = fontPaths.filter(path => !fontsInOrders.has(path));

        // Delete fonts that are not referenced in any orders
        if (fontsToDelete.length > 0) {
          console.log(`Deleting ${fontsToDelete.length} unused font files...`);
          const deleteResult = await deleteFonts(supabase, fontsToDelete);
          if (!deleteResult.success) {
            console.warn('Some fonts failed to delete:', deleteResult.errors);
          }
        } else {
          console.log('All fonts are used in orders, skipping deletion');
        }
      }
    }

    // 4. Delete the design record
    const { error: deleteError } = await supabase
      .from('saved_designs')
      .delete()
      .eq('id', designId);

    if (deleteError) {
      console.error('Error deleting design:', deleteError);
      throw deleteError;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete design:', error);
    return false;
  }
}
