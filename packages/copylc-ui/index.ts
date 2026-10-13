import { readFileSync } from 'fs';
import { join } from 'path';
import { Context, Handler } from 'hydrooj';

const styles = readFileSync(join(__dirname, 'frontend/copylc-ui.css'), 'utf8');

class CopyLCStylesHandler extends Handler {
    noCheckPermView = true;

    async get() {
        this.response.type = 'text/css';
        this.response.body = styles;
        this.response.addHeader('Cache-Control', 'no-cache');
    }
}

export const name = 'copylc-ui';

export function apply(ctx: Context) {
    if (process.env.HYDRO_CLI) return;
    ctx.Route('copylc_ui_styles', '/copylc-ui.css', CopyLCStylesHandler);
}
