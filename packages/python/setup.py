from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="memstamp",
    version="0.1.0",
    author="Dharma Technologies, Inc.",
    author_email="hello@dharma.us",
    description="Python SDK for memstamp — verifiable audit trails for AI agents",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Dharma-Technologies/memstamp",
    packages=find_packages(exclude=["tests", "tests.*"]),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.10",
    install_requires=[
        "httpx>=0.25.0",
        "pydantic>=2.5.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-asyncio>=0.23.0",
            "ruff>=0.1.0",
            "mypy>=1.8.0",
        ],
        "langchain": ["langchain>=0.1.0"],
    },
    project_urls={
        "Bug Tracker": "https://github.com/Dharma-Technologies/memstamp/issues",
        "Documentation": "https://memstamp.io/docs",
        "Source Code": "https://github.com/Dharma-Technologies/memstamp",
    },
)
