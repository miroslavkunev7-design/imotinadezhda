# Font licences

The program bundles two font families as WOFF2 subsets (Latin and Cyrillic). The file names follow the
Fontsource convention `<family>-<subset>-<weight>-<style>.woff2`. The build copies the files unchanged;
no font is downloaded at run time.

Both families are licensed under the **SIL Open Font License, Version 1.1** (full text at the end of
this file). The licence allows bundling and redistributing the fonts with software, including for
commercial use, as long as the copyright notice and the licence travel with every copy and the fonts
are not sold on their own.

| Files | Family | Version in the files | Licence |
| --- | --- | --- | --- |
| `roboto-condensed-latin-400-normal.woff2`, `roboto-condensed-latin-700-normal.woff2`, `roboto-condensed-cyrillic-400-normal.woff2`, `roboto-condensed-cyrillic-700-normal.woff2` | Roboto Condensed (Regular, Bold) | 3.008; 2023 | SIL OFL 1.1 |
| `pt-serif-cyrillic-400-normal.woff2`, `pt-serif-cyrillic-700-normal.woff2`, `pt-serif-latin-700-normal.woff2` | PT Serif (Regular, Bold) | 1.000W OFL | SIL OFL 1.1 |

## Roboto Condensed

    Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic)

    This Font Software is licensed under the SIL Open Font License, Version 1.1.

Designer: Christian Robertson. Source: <https://github.com/googlefonts/roboto-classic>.

Note on the metadata inside the files: the `name` table of these 3.008 binaries still reads
"Copyright 2011 Google Inc. All Rights Reserved." with the licence URL
<http://www.apache.org/licenses/LICENSE-2.0>, which was the family's earlier licence (Apache License,
Version 2.0). The upstream project (`OFL.txt` in googlefonts/roboto-classic), Google Fonts
(`ofl/robotocondensed` in google/fonts) and the Fontsource package (`@fontsource/roboto-condensed`,
licence field `OFL-1.1`) all publish the family under the SIL OFL 1.1. Both licences permit this use.

## PT Serif

    Copyright (c) 2010, ParaType Ltd. (http://www.paratype.com/public),
    with Reserved Font Names "PT Sans", "PT Serif" and "ParaType".

    This Font Software is licensed under the SIL Open Font License, Version 1.1.

Designer: ParaType. The `name` table of the files reads "Copyright © 2010 ParaType Ltd. All rights
reserved.", version "1.000W OFL", licence URL <http://scripts.sil.org/OFL_web>.

## How this was checked

Checked on 2026-11-17 against:

- the `name` table of each bundled `.woff2` file (copyright, version and licence URL records);
- `OFL.txt` in <https://github.com/googlefonts/roboto-classic>;
- `ofl/robotocondensed/OFL.txt`, `ofl/robotocondensed/METADATA.pb`, `ofl/ptserif/OFL.txt` and
  `ofl/ptserif/METADATA.pb` in <https://github.com/google/fonts>;
- the `license` field of `@fontsource/roboto-condensed` and `@fontsource/pt-serif` (5.3.0) on npm.

## SIL Open Font License, Version 1.1

The licence is also available with a FAQ at <https://openfontlicense.org>.

```text
-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
