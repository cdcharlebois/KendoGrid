# KendoGrid Widget For Mendix

> This widget requires a license from Telerik for Kendo which is **not** provided by Mendix, or the maintainer of this widget

### Installation

1. Download and include this widget in your Mendix project

### Configuration

To style this widget with Kendo Styling, you'll need to follow these steps:

1. Download the Kendo-UI package from Telerik
2. Copy the `kendo.common.min.css` file from the Kendo UI package. 
3. Paste this file into your project's `theme/styles/sass/custom/` directory and rename as a spinal-case SCSS partial. For example, `_kendo-common.scss`.
4. Copy the `Default/` theme resources directory from the Kendo UI package. (it will have a bunch of _.gif_ and _.png_ files inside it)
5. Paste this directory into your project's `theme/styles/css/custom/` directory ***Note this is different than the _sass_ directory** 
6. In your project's `custom.scss` file, include the new resources, like this:
```scss
@import "custom-variables";
@import "kendo-common";
```

7. Repeat steps 2 through 6 for any additional themes, i.e. Material:
    - Step 2: find and copy `kendo.material.min.css`
    - Step 3: paste and save as `_kendo-material.scss` in `theme/styles/sass/custom`
    - Step 4: find and copy `Material/`
    - Step 5: paste into `theme/styles/css/custom/`
    - Step 6: update `custom.scss`
    ```scss
    @import "custom-variables";
    @import "kendo-common";
    @import "kendo-material";
    ```
