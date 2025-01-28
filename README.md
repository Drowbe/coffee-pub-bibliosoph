# Coffee Pub Bibliosoph

Introducing "Coffee Pub Scribe," the latest in the growing suite of Coffee Pub tools, designed to bring the warmth and camaraderie of a storyteller's coffee pub to your Foundry VTT gaming table. This module transforms the storytelling experience, turning journal entries into beautifully formatted narrative cards that invite players into the heart of your tale without ever leaving the chat window's embrace.

## ⚡ Features

- **Part of Coffee Pub Tools:** Scribe joins a family of tools aimed at enriching your gaming experience with the charm of a coffee pub meet-up.
- **Stylized Text Cards:** Enliven your campaign narrative with text cards that are as visually appealing as they are captivating.
- **Chat Window Integration:** Merge your storytelling seamlessly into the game's chat, maintaining engagement and immersion.
- **Custom Design Options:** Customize the look of your narrative cards to fit the atmosphere and aesthetic of your campaign's world.
- **User-friendly Interface:** Intuitive design for quick learning and use, so you can focus more on the story and less on the setup.
- **Adaptive Text Formatting:** Auto-adjusting content for readability, ensuring that your story's presentation is always top-notch.
- **Journal Enhancements:** For GMs, view the formatted player cards directly within your journal entries, linking narration and gameplay together smoothly.
- **HTML Blockquote Integration:** Utilize simple HTML to elevate your storytelling. Wrap any text in blockquote tags, and Scribe will transform it into a beautifully formatted card, consistent with the Scribe style.

## 📦 Installation

You can install this module by using the following manifest URL in Foundry VTT:
```
https://github.com/Drowbe/coffee-pub-bibliosoph/releases/latest/download/module.json
```

### Requirements
- Foundry VTT v12 (compatible)
- Foundry VTT v13 (ready)

## 📖 Usage Guide

### Card Format

To build a nicely formatted card, all you need to do is leverage the markup built right into foundry. Anything you put within "blockquote" tag will be formatted as a card. This DOES MEAN that if you plan to use blockquote for other reasons, any of that content will be formatted accordingly.

```html
<blockquote>
    <h4>Card Title</h4> 
    <p>Some narrative here.</p>
    <h5>Image Title</h5>
    <img src="link to image">
    <hr>
    <p>Optional additional narrative</p>
    <h6><strong>Name of Speaker</strong> "The words the speaker is saying."</h6>
    <h6><em>Inner Dialogue</em> "The text that the player is thinking"</h6>
</blockquote>
```

As we add more layout elements to Scribe, we will update this simple framework as necessary.

## 📄 License

This module is licensed under the [MIT License](LICENSE).

## 🤝 Contributing

Feel free to submit issues and enhancement requests!