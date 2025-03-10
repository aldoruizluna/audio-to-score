# Development Consistency Rules

## 1. Code Style and Organization

- Follow PEP 8 style guidelines for Python code
- Use 4 spaces for indentation (no tabs)
- Keep line length to 100 characters or less
- Organize imports in this order: standard library, third-party libraries, local modules
- Use descriptive variable and function names
- Each module should have a clear, single responsibility

## 2. Naming Conventions

- Use `snake_case` for variables, functions, and modules
- Use `PascalCase` for classes
- Use `UPPER_CASE` for constants
- Prefix private methods and variables with underscore (e.g., `_private_method`)
- Use descriptive, meaningful names that reflect the purpose

## 3. Error Handling

- Use specific exception types rather than generic `Exception`
- Log exceptions with appropriate severity levels
- Include context information in error messages
- Use try-except blocks to handle anticipated errors gracefully
- Never silently catch exceptions without logging or handling

## 4. Documentation

- Every module, class, and function must have docstrings following Google style
- Include type hints for function parameters and return values
- Document complex algorithms with comments explaining the logic
- Keep README.md and other documentation in sync with code changes
- Add examples for complex functionalities

## 5. Testing

- Write unit tests for all non-trivial functions
- Maintain 80%+ code coverage
- Test edge cases and error conditions
- Use descriptive test names that explain the test's purpose
- Mock external dependencies in tests

## 6. Module Interfaces

- Define clear interfaces between microservices
- Use well-defined data models for inputs and outputs
- Keep API endpoints consistent across the system
- Validate all inputs at module boundaries
- Return consistent error responses

## 7. Configuration Management

- Store configuration in environment variables or config files
- Never hardcode sensitive information
- Use separate configurations for development, testing, and production
- Document all configuration options
- Provide sensible defaults when possible

## 8. Versioning and Releases

- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Document all changes in a CHANGELOG.md file
- Tag releases in git
- Create detailed release notes

## 9. Microservice Architecture

- Each microservice should be independently deployable
- Services should communicate through well-defined APIs
- Use message queues for asynchronous processing
- Implement health checks for each service
- Monitor service performance and errors

## 10. Security Practices

- Validate all user inputs
- Use HTTPS for all communications
- Implement proper authentication and authorization
- Keep dependencies updated to avoid vulnerabilities
- Follow the principle of least privilege
