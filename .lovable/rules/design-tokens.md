# Design Tokens

Token reference for **И.Надежда Топа**. Use utility classes and CSS variables — never raw values.

## Colors

Apply with any color utility: `bg-<name>`, `text-<name>`, `border-<name>`, `ring-<name>`, `divide-<name>`, etc.

| Name                                   | CSS variable                           |
| -------------------------------------- | -------------------------------------- |
| `DEFAULT_TOKENS.background`            | `DEFAULT_TOKENS.background`            |
| `DEFAULT_TOKENS.foreground`            | `DEFAULT_TOKENS.foreground`            |
| `DEFAULT_TOKENS.card`                  | `DEFAULT_TOKENS.card`                  |
| `DEFAULT_TOKENS.cardForeground`        | `DEFAULT_TOKENS.cardForeground`        |
| `DEFAULT_TOKENS.primary`               | `DEFAULT_TOKENS.primary`               |
| `DEFAULT_TOKENS.primaryForeground`     | `DEFAULT_TOKENS.primaryForeground`     |
| `DEFAULT_TOKENS.secondary`             | `DEFAULT_TOKENS.secondary`             |
| `DEFAULT_TOKENS.secondaryForeground`   | `DEFAULT_TOKENS.secondaryForeground`   |
| `DEFAULT_TOKENS.muted`                 | `DEFAULT_TOKENS.muted`                 |
| `DEFAULT_TOKENS.mutedForeground`       | `DEFAULT_TOKENS.mutedForeground`       |
| `DEFAULT_TOKENS.accent`                | `DEFAULT_TOKENS.accent`                |
| `DEFAULT_TOKENS.accentForeground`      | `DEFAULT_TOKENS.accentForeground`      |
| `DEFAULT_TOKENS.border`                | `DEFAULT_TOKENS.border`                |
| `DEFAULT_TOKENS.sidebar`               | `DEFAULT_TOKENS.sidebar`               |
| `DEFAULT_TOKENS.sidebarForeground`     | `DEFAULT_TOKENS.sidebarForeground`     |
| `TOKEN_LABELS.background`              | `TOKEN_LABELS.background`              |
| `TOKEN_LABELS.foreground`              | `TOKEN_LABELS.foreground`              |
| `TOKEN_LABELS.card`                    | `TOKEN_LABELS.card`                    |
| `TOKEN_LABELS.cardForeground`          | `TOKEN_LABELS.cardForeground`          |
| `TOKEN_LABELS.primary`                 | `TOKEN_LABELS.primary`                 |
| `TOKEN_LABELS.primaryForeground`       | `TOKEN_LABELS.primaryForeground`       |
| `TOKEN_LABELS.secondary`               | `TOKEN_LABELS.secondary`               |
| `TOKEN_LABELS.secondaryForeground`     | `TOKEN_LABELS.secondaryForeground`     |
| `TOKEN_LABELS.muted`                   | `TOKEN_LABELS.muted`                   |
| `TOKEN_LABELS.mutedForeground`         | `TOKEN_LABELS.mutedForeground`         |
| `TOKEN_LABELS.accent`                  | `TOKEN_LABELS.accent`                  |
| `TOKEN_LABELS.accentForeground`        | `TOKEN_LABELS.accentForeground`        |
| `TOKEN_LABELS.border`                  | `TOKEN_LABELS.border`                  |
| `TOKEN_LABELS.sidebarForeground`       | `TOKEN_LABELS.sidebarForeground`       |
| `TOKEN_TO_CSS_VAR.background`          | `TOKEN_TO_CSS_VAR.background`          |
| `TOKEN_TO_CSS_VAR.foreground`          | `TOKEN_TO_CSS_VAR.foreground`          |
| `TOKEN_TO_CSS_VAR.card`                | `TOKEN_TO_CSS_VAR.card`                |
| `TOKEN_TO_CSS_VAR.cardForeground`      | `TOKEN_TO_CSS_VAR.cardForeground`      |
| `TOKEN_TO_CSS_VAR.primary`             | `TOKEN_TO_CSS_VAR.primary`             |
| `TOKEN_TO_CSS_VAR.primaryForeground`   | `TOKEN_TO_CSS_VAR.primaryForeground`   |
| `TOKEN_TO_CSS_VAR.secondary`           | `TOKEN_TO_CSS_VAR.secondary`           |
| `TOKEN_TO_CSS_VAR.secondaryForeground` | `TOKEN_TO_CSS_VAR.secondaryForeground` |
| `TOKEN_TO_CSS_VAR.muted`               | `TOKEN_TO_CSS_VAR.muted`               |
| `TOKEN_TO_CSS_VAR.mutedForeground`     | `TOKEN_TO_CSS_VAR.mutedForeground`     |
| `TOKEN_TO_CSS_VAR.accent`              | `TOKEN_TO_CSS_VAR.accent`              |
| `TOKEN_TO_CSS_VAR.accentForeground`    | `TOKEN_TO_CSS_VAR.accentForeground`    |
| `TOKEN_TO_CSS_VAR.border`              | `TOKEN_TO_CSS_VAR.border`              |
| `TOKEN_TO_CSS_VAR.sidebarForeground`   | `TOKEN_TO_CSS_VAR.sidebarForeground`   |
| `background`                           | `--background`                         |
| `foreground`                           | `--foreground`                         |
| `card`                                 | `--card`                               |
| `card-foreground`                      | `--card-foreground`                    |
| `popover`                              | `--popover`                            |
| `popover-foreground`                   | `--popover-foreground`                 |
| `primary`                              | `--primary`                            |
| `primary-foreground`                   | `--primary-foreground`                 |
| `secondary`                            | `--secondary`                          |
| `secondary-foreground`                 | `--secondary-foreground`               |
| `muted`                                | `--muted`                              |
| `muted-foreground`                     | `--muted-foreground`                   |
| `accent`                               | `--accent`                             |
| `accent-foreground`                    | `--accent-foreground`                  |
| `destructive`                          | `--destructive`                        |
| `destructive-foreground`               | `--destructive-foreground`             |
| `border`                               | `--border`                             |
| `input`                                | `--input`                              |
| `ring`                                 | `--ring`                               |
| `chart-1`                              | `--chart-1`                            |
| `chart-2`                              | `--chart-2`                            |
| `chart-3`                              | `--chart-3`                            |
| `chart-4`                              | `--chart-4`                            |
| `chart-5`                              | `--chart-5`                            |
| `sidebar`                              | `--sidebar`                            |
| `sidebar-foreground`                   | `--sidebar-foreground`                 |
| `sidebar-primary`                      | `--sidebar-primary`                    |
| `sidebar-primary-foreground`           | `--sidebar-primary-foreground`         |
| `sidebar-accent`                       | `--sidebar-accent`                     |
| `sidebar-accent-foreground`            | `--sidebar-accent-foreground`          |
| `sidebar-border`                       | `--sidebar-border`                     |
| `sidebar-ring`                         | `--sidebar-ring`                       |
| `crm-panel`                            | `--crm-panel`                          |
| `crm-panel-strong`                     | `--crm-panel-strong`                   |
| `crm-row-alt`                          | `--crm-row-alt`                        |
| `crm-border`                           | `--crm-border`                         |
| `crm-accent`                           | `--crm-accent`                         |
| `crm-accent-soft`                      | `--crm-accent-soft`                    |
| `crm-surface`                          | `--crm-surface`                        |
| `crm-row-hover`                        | `--crm-row-hover`                      |
| `crm-row-selected`                     | `--crm-row-selected`                   |
| `crm-row-selected-muted`               | `--crm-row-selected-muted`             |
| `crm-focus-ring`                       | `--crm-focus-ring`                     |
| `crm-readable-bg`                      | `--crm-readable-bg`                    |
| `crm-readable-bg-strong`               | `--crm-readable-bg-strong`             |
| `crm-readable-bg-alt`                  | `--crm-readable-bg-alt`                |
| `crm-readable-muted`                   | `--crm-readable-muted`                 |
| `crm-readable-border`                  | `--crm-readable-border`                |
| `crm-readable-header`                  | `--crm-readable-header`                |
| `bordo`                                | `--bordo`                              |
| `bordo-deep`                           | `--bordo-deep`                         |
| `sp-bg`                                | `--sp-bg`                              |
| `sp-btn`                               | `--sp-btn`                             |
| `sp-label`                             | `--sp-label`                           |

## Typography

Typography classes (`font-*` for families, `text-*` for sizes):

| Class          | CSS variable                  |
| -------------- | ----------------------------- |
| —              | `DEFAULT_TOKENS.fontHeading`  |
| —              | `DEFAULT_TOKENS.fontBody`     |
| —              | `DEFAULT_TOKENS.fontSizeBase` |
| `font-sans`    | `--font-sans`                 |
| `font-display` | `--font-display`              |
| —              | `--crm-text`                  |
| —              | `--crm-text-muted`            |
| —              | `--crm-row-hover-text`        |
| —              | `--crm-row-selected-text`     |
| —              | `--crm-readable-text`         |
| —              | `--crm-readable-header-text`  |
| —              | `--sp-text`                   |
| —              | `--sp-btn-text`               |

## Border Radius

Border-radius classes:

| Class         | CSS variable   |
| ------------- | -------------- |
| `rounded-sm`  | `--radius-sm`  |
| `rounded-md`  | `--radius-md`  |
| `rounded-xl`  | `--radius-xl`  |
| `rounded-2xl` | `--radius-2xl` |
| `rounded-3xl` | `--radius-3xl` |
| `rounded-4xl` | `--radius-4xl` |
| `rounded`     | `--radius`     |

## Other

Reference via `var(--name)` in inline styles or CSS.

| CSS variable               |
| -------------------------- |
| `DEFAULT_PRESETS.cards`    |
| `DEFAULT_PRESETS.navbar`   |
| `DEFAULT_PRESETS.logo`     |
| `DEFAULT_PRESETS.forms`    |
| `DEFAULT_PRESETS.buttons`  |
| `TOKEN_LABELS.sidebar`     |
| `TOKEN_TO_CSS_VAR.sidebar` |
| `--logo-scroll-w`          |
| `--header-bar-h`           |
| `--site-header-offset`     |
| `--gold`                   |
| `--cityref-max`            |
| `--cityref-gutter`         |
| `--active`                 |
| `--tight`                  |
| `--brush-mask-panel`       |
| `--brush-mask-row`         |
| `--brush-mask-field`       |
| `--brush-mask-divider`     |
| `--brush-grain`            |
| `--soft`                   |
| `--top`                    |
