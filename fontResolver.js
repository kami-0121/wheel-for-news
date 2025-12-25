export function resolveFontFamily(family) {
  switch (family) {
    case 'Excalifont':
      return 'Assistant, system-ui, -apple-system, BlinkMacSystemFont, "Microsoft JhengHei", sans-serif';

    case 'NotoSansTC':
      return 'Noto Sans TC, "Microsoft JhengHei", sans-serif';

    case 'SourceHanSerifTC':
      return 'Source Han Serif TC, "PMingLiU", serif';

    default:
      return family;
  }
}
