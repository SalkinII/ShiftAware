# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "404" [level=1] [ref=e5]
      - heading "Page Not Found" [level=2] [ref=e6]
      - paragraph [ref=e7]: The page you're looking for doesn't exist or has been moved.
    - generic [ref=e8]:
      - link "Go to Dashboard" [ref=e9] [cursor=pointer]:
        - /url: /dashboard
        - img [ref=e10]
        - text: Go to Dashboard
      - button "Go Back" [ref=e13]:
        - img [ref=e14]
        - text: Go Back
  - status [ref=e16]:
    - generic [ref=e17]:
      - img [ref=e19]
      - generic [ref=e21]:
        - text: Static route
        - button "Hide static indicator" [ref=e22] [cursor=pointer]:
          - img [ref=e23]
  - alert [ref=e26]
```