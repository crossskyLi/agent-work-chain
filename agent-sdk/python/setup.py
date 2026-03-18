from setuptools import setup, find_packages

setup(
    name="agent-trustchain",
    version="1.0.0",
    packages=find_packages(),
    install_requires=["requests>=2.28.0"],
    python_requires=">=3.8",
    description="Python SDK for the Agent TrustChain System",
    author="Agent Work Chain Team",
    license="MIT",
)
