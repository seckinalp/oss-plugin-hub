# Contributing to Plugin Discovery Hub

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Getting Started

🌐 **Live Site**: [https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/oss-plugin-hub.git
   cd oss-plugin-hub
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Fetch initial data**:
   ```bash
   npm run fetch-plugins
   ```
5. **Start development server**:
   ```bash
   npm run dev
   ```

## Development Workflow

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test your changes:
   ```bash
   npm run build
   npm run lint
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a Pull Request

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Code Style

- Use TypeScript for type safety
- Follow ESLint configuration
- Use meaningful variable and function names
- Add comments for complex logic
- Keep components small and focused

## Project Structure

```
oss-plugin-hub/
├── app/              # Next.js app directory (pages, layouts)
├── components/       # React components
├── types/           # TypeScript type definitions
├── scripts/         # Data fetching and processing scripts
├── data/            # Plugin data storage (JSON files)
├── public/          # Static assets (RSS feed, etc.)
└── .github/         # GitHub Actions workflows
```

## Adding New Features

### Adding Support for New Plugin Platforms

1. Create new type definitions in `types/`
2. Add fetch script in `scripts/`
3. Update UI components to support new platform
4. Add filtering/categorization by platform
5. Update documentation

### Improving UI/UX

1. Follow the existing design system (Tailwind CSS)
2. Ensure responsive design (mobile, tablet, desktop)
3. Maintain dark mode compatibility
4. Test accessibility

## Testing

Before submitting a PR:

1. Test locally with `npm run dev`
2. Build production version: `npm run build`
3. Run linter: `npm run lint`
4. Test data fetching: `npm run fetch-plugins`
5. Test RSS generation: `npm run generate-rss`

## Pull Request Process

1. Update documentation if needed
2. Ensure your code follows the style guidelines
3. Test thoroughly
4. Write a clear PR description explaining:
   - What changes were made
   - Why they were made
   - How to test them
5. Link any related issues

## Adding New Platforms

Want to add support for VS Code, JetBrains, Sublime Text, or other platforms?

Check out **[ADDING_PLATFORMS.md](./ADDING_PLATFORMS.md)** for a complete guide!

The app is designed to make adding new platforms easy:
1. Create a fetch script for the platform
2. Add it to the main fetch script
3. Done! The UI automatically adapts

## Areas for Contribution

- **New Platforms**: Add VS Code, JetBrains, Sublime Text, etc.
- **Features**: Advanced filtering, analytics, trending plugins
- **UI/UX**: Improve design, accessibility, mobile experience
- **Performance**: Optimize build size, loading times
- **Documentation**: Improve guides, add examples
- **Bug Fixes**: Fix reported issues
- **Testing**: Add unit tests, integration tests

## Questions?

Feel free to open an issue for:
- Bug reports
- Feature requests
- Questions about the codebase
- Suggestions for improvements

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

