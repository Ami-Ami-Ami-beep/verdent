# PyInstaller-Build fuer Jarvis.exe:  pyinstaller jarvis.spec --noconfirm
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Module, die selbstgeschriebene Plugins oft brauchen. In der .exe ist nur drin,
# was hier (oder im Jarvis-Code) importiert wird.
plugin_modules = [
    "asyncio", "csv", "ctypes", "hashlib", "http.server", "psutil", "socket", "sqlite3",
    "statistics", "tarfile", "urllib.request", "uuid", "winreg", "xml.etree.ElementTree", "zipfile",
]

a = Analysis(
    ["jarvis_app.py"],
    pathex=["."],
    datas=[
        ("jarvis/gui/index.html", "jarvis/gui"),
        ("jarvis/config.example.yaml", "jarvis"),
    ] + collect_data_files("tzdata"),
    hiddenimports=collect_submodules("jarvis") + collect_submodules("tzdata") + plugin_modules,
    excludes=["tkinter", "matplotlib", "numpy"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Jarvis",
    icon="assets/jarvis.ico",
    console=False,
    upx=False,
)
