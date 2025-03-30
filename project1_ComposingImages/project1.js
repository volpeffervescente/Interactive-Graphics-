// bgImg is the background image to be modified.
// fgImg is the foreground image.
// fgOpac is the opacity of the foreground image.
// fgPos is the position of the foreground image in pixels. It can be negative and (0,0) means 
// the top-left pixels of the foreground and background are aligned.
function composite( bgImg, fgImg, fgOpac, fgPos )
{

      /*
    So, basically, what I did is the following: 
    i) extract pixel data;
    ii)iterate over foreground pixels;
    iii)compute the target position by adjusting the pixrl position given by fgPos;
    iv)skip out of bounds pixels so the foreground image doesn't draw outside the background;
    v)blend colors using alpha blending, in particular computing the output alpha and thenn blending the rgb values using the formula: (fg_alpha * Channel_fg + ((1 - fg_alpha)* bg_alpha * Channel_bg)) / alpha
    vi)update the background Image pixel values.
    */
    //i)
    let bg_data = bgImg.data; //I retrieve the pixel data of the background image
    let fg_data = fgImg.data; //I do the same with the pixel data of the foreground image
    //then
    let bg_width = bgImg.width; //I retrieve the wifth of the background image
    let bg_height = bgImg.height;//I retrieve the height of the background image
    let fg_width = fgImg.width; //I retrieve the width data of the foreground image
    let fg_height = fgImg.height;//I retrieve the height of the foreground image
    //now...
    //ii)
    //I slide each pixel of the foreground image
    for (let y = 0; y < fg_height; y++) { //by row
        for (let x = 0; x < fg_width; x++) { //by col
            //iii)
            //Here's Where the Pixel in the Background Ends Up:
            let bg_x = x + fgPos.x; 
            let bg_y = y + fgPos.y;
            //iv)
            //I check wheter the pixel is within the bounds of the background image 
            if (bg_x < 0 || bg_y < 0 || bg_x >= bg_width || bg_y >= bg_height) {
                continue; // If not, I ignore that pixel and I move on to the next one
            }
            let fg_index = (y * fg_width + x)*4; //I calculte the index of the current pixel in the foreground
            let bg_index = (bg_y * bg_width + bg_x)*4; //I calculte the index of the current pixel in the background
            //v)
            //so I compute, for the foreground image:
            let fg_red = fg_data[fg_index]; //red 
            let fg_green = fg_data[fg_index + 1]; //green
            let fg_blue = fg_data[fg_index + 2]; //blue
            let fg_alpha = (fg_data[fg_index + 3] / 255) * fgOpac; //alpha, scaled with fgOpac value 
            //also for the bacground image:
            let bg_red = bg_data[bg_index]; //red
            let bg_green = bg_data[bg_index + 1]; //green
            let bg_blue = bg_data[bg_index + 2]; //blue
            let bg_alpha = bg_data[bg_index + 3] / 255; //alpha (8 bit)

            let alpha = fg_alpha + ((1 - fg_alpha)*bg_alpha); //I compute the final alpha of the composited pixel 
            if (alpha > 0) {//I check if the pixel is visible, and if so:
                //vi)
                //I use this formula because both images have an alpha value, otherwise we could have used other formulas to set the channel value 
                bg_data[bg_index] = (fg_alpha * fg_red + ((1 - fg_alpha)* bg_alpha * bg_red)) / alpha; //I compute the new red
                bg_data[bg_index + 1] = (fg_alpha * fg_green + ((1 - fg_alpha)* bg_alpha * bg_green)) / alpha; //I compute the new green
                bg_data[bg_index + 2] = (fg_alpha * fg_blue + ((1 - fg_alpha)* bg_alpha * bg_blue)) / alpha; //I compute the new blue
                bg_data[bg_index + 3] = alpha * 255; //I compute the new alpha
            }
        }
    }
}
