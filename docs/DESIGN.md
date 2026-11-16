# Kura Design site: style guide

Every page follows these rules. Change a value in `src/styles/site.css` only if it changes here too.

## Idea
Two things come from the studio itself.
- The front door: door red with white, widely spaced capital lettering stacked on three lines. The header and footer are that door: a red band carrying "KURA / DESIGN / STUDIO" set the same way. The home statement sits on red with the door's brick relief drawn as faint lines.
- Scale: Kura sorts its work as Small, Medium, Large, Extra large. The home page shows one block per scale, each as wide as its scale.
Everything else stays quiet so the images carry the pages.

## Colour
Two colours only.
| Name | Value | Use |
|---|---|---|
| Door red | `#b81f2a` | Header and footer bands, headings, active filters, links on hover, focus |
| White | `#ffffff` | Page background, type on red |

Supporting neutrals, never used as colour: text `#1d1a1a`, secondary text `#6f6a6a`, hairlines `#e4dfdd`, relief lines on red `#9c1822`.
No gradients, no shadows, no rounded corners.

## Type
One family: Jost, a geometric sans close to the door lettering. Weights 400 and 500.
The wordmark is the only capitals on the site: 13 px, 0.3em letter spacing, three stacked lines, as on the door.
Sizes: 14, 17, 21 px, then two fluid display sizes (28 to 44 px, 40 to 80 px). Sentence case everywhere else.
Body lines stay under about 75 characters.

## Images
Never cropped. Every image is shown at its own proportions.
- Work list: three columns of mixed heights.
- Project page: a collage. Rows alternate between one large image and two or three side by side at equal height.
- Each image is saved at five widths (480 to 2000 px, WebP). The browser downloads the smallest that fills the space, images below the fold load only when reached, and each shows its average colour while loading.

## Layout
12-column grid, left aligned. One gutter value and one section spacing value, both fluid. Hairlines appear only between rows of a list.

## Motion
None on load or scroll. The only movement is the full-screen image viewer opening.

## Words
Plain labels that say what a thing is: Work, Studio, Contact, Scale, Type, Next project.
