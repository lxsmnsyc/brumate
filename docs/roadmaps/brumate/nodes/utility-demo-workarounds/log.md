# Log: utility-demo-workarounds

- I18nProviderLocaleDemo.brm now has one `I18nProvider {locale}` and a Toolbar of Buttons. The page had two switches (the top demo from #365 and this one), so I18nProviderDemo.brm is static (ar-EG) again. The e2e step uses the buttons `de-DE` and the last `.ui-bar`, so the use-case demo stays.
- i18n-provider.md: the intro points to "A locale switch"; the `#if` sentence is gone.
- SelectionIndicatorToggleDemo.brm uses `cubic-bezier(0.2, 0, 0, 1)`, the value of `.ui-indicator`.
- TransitionStyled.brm untouched (the span beside a Transition stays).
