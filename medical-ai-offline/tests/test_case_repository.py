"""Case repository + database tests."""
from __future__ import annotations

from app.data.database import decode_json, encode_json
from app.domain.entities import Case, ChatMessage, Medicine, Prescription
from app.domain.enums import MessageRole


def make_case(name="Test case", med="paracetamol") -> Case:
    case = Case(name=name)
    case.prescription = Prescription(
        medicines=[Medicine(name=med, strength="500 mg", frequency="three times a day")],
        raw_ocr_text="ocr",
        ocr_confidence=0.94,
        ocr_engine="mock",
    )
    return case


def test_create_and_get(fresh_db):
    repo = fresh_db["cases"]
    case = make_case()
    repo.create(case)
    loaded = repo.get(case.id)
    assert loaded is not None
    assert loaded.name == "Test case"
    assert loaded.prescription.medicines[0].name == "paracetamol"


def test_list_order_by_updated(fresh_db):
    repo = fresh_db["cases"]
    first = make_case("a")
    second = make_case("b")
    repo.create(first)
    repo.create(second)
    cases = repo.list_all()
    assert {c.name for c in cases} == {"a", "b"}


def test_update_roundtrip(fresh_db):
    repo = fresh_db["cases"]
    case = make_case()
    repo.create(case)
    case.name = "Renamed"
    case.prescription.medicines[0].verified_by_user = True
    repo.update(case)
    loaded = repo.get(case.id)
    assert loaded.name == "Renamed"
    assert loaded.prescription.medicines[0].verified_by_user is True


def test_search(fresh_db):
    repo = fresh_db["cases"]
    repo.create(make_case("Cough & fever"))
    repo.create(make_case("Skin rash"))
    assert len(repo.search("cough")) == 1
    assert len(repo.search("sk")) == 1
    assert len(repo.search("paracetamol")) == 2


def test_delete_removes_case_and_chat(fresh_db):
    repo = fresh_db["cases"]
    chat = fresh_db["chat"]
    case = make_case()
    repo.create(case)
    chat.add_message(ChatMessage(case_id=case.id, role=MessageRole.USER.value, content="hi"))
    assert repo.delete(case.id) is True
    assert repo.get(case.id) is None
    assert chat.list_messages(case.id) == []


def test_database_schema_created(fresh_db):
    db = fresh_db["db"]
    tables = {r[0] for r in db.query_all("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"cases", "chat_messages"} <= tables


def test_json_helpers():
    data = {"a": [1, 2], "b": {"c": "x"}}
    assert decode_json(encode_json(data)) == data


def test_count(fresh_db):
    repo = fresh_db["cases"]
    repo.create(make_case())
    repo.create(make_case())
    assert repo.count() == 2