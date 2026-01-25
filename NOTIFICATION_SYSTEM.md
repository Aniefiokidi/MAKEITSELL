# Notification System Documentation

A comprehensive notification system for displaying toast-style notifications throughout the application.

## Features

- ✅ **4 Notification Types**: Success, Error, Warning, Info
- ✅ **Auto-dismiss**: Configurable duration with default 5 seconds
- ✅ **Manual dismiss**: Close button on each notification
- ✅ **Multiple notifications**: Stack multiple notifications
- ✅ **Smooth animations**: Slide-in and fade-out transitions
- ✅ **Dark mode support**: Adapts to theme
- ✅ **Accessible**: Semantic HTML and ARIA attributes

## Usage

### 1. Import the hook

```tsx
import { useNotification } from "@/contexts/NotificationContext"
```

### 2. Use in your component

```tsx
function MyComponent() {
  const { success, error, warning, info } = useNotification()
  
  const handleAction = async () => {
    try {
      // Your logic here
      await someApiCall()
      success('Operation completed successfully!')
    } catch (err) {
      error('Something went wrong', 'Error')
    }
  }
  
  return <button onClick={handleAction}>Click me</button>
}
```

## API Reference

### Methods

#### `success(message, title?, duration?)`
Display a success notification (green)
```tsx
success('Product created!', 'Success', 5000)
```

#### `error(message, title?, duration?)`
Display an error notification (red)
```tsx
error('Failed to save', 'Error', 7000)
```

#### `warning(message, title?, duration?)`
Display a warning notification (yellow)
```tsx
warning('Low stock alert', 'Warning')
```

#### `info(message, title?, duration?)`
Display an info notification (blue)
```tsx
info('New update available', 'Information')
```

### Parameters

- **message** (required): The notification message text
- **title** (optional): The notification title/heading
- **duration** (optional): Auto-dismiss duration in milliseconds (default: 5000, set to 0 for persistent)

## Advanced Usage

### Custom duration
```tsx
// Show for 10 seconds
success('Saved successfully', undefined, 10000)

// Never auto-dismiss (user must close manually)
error('Critical error', 'Error', 0)
```

### Adding notifications programmatically
```tsx
const { addNotification } = useNotification()

addNotification({
  type: 'success',
  message: 'Custom notification',
  title: 'Title',
  duration: 3000
})
```

### Removing notifications manually
```tsx
const { removeNotification } = useNotification()
removeNotification(notificationId)
```

## Examples

### Product Creation
```tsx
try {
  await createProduct(data)
  success('Product created successfully!', 'Your product is now live')
  router.push('/products')
} catch (err) {
  error('Failed to create product', 'Creation Failed')
}
```

### Form Validation
```tsx
if (!formData.email) {
  warning('Email is required', 'Validation Error')
  return
}
```

### Information Messages
```tsx
info('Your session will expire in 5 minutes', 'Session Timeout')
```

## Styling

The notification box is positioned at `top-4 right-4` with a high z-index (`z-[100]`) to appear above most content. Each notification includes:
- Icon matching the type (checkmark, alert, warning, info)
- Color-coded borders and backgrounds
- Smooth slide-in from right animation
- Fade-out animation on dismiss

## Component Location

- Context: `contexts/NotificationContext.tsx`
- Component: `components/NotificationBox.tsx`
- Layout integration: `app/layout.tsx`
