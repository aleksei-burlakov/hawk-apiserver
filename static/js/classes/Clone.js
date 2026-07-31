class Clone {
    #cloneIDInput;
    #childResourceSelect;
    #metaKVGroup;
    constructor(cloneIDInput, childResourceSelect, metaKVGroup) {
        this.#cloneIDInput = cloneIDInput;
        this.#childResourceSelect = childResourceSelect;
        this.#metaKVGroup = metaKVGroup;
    }

    async create() {
        const newID = this.#cloneIDInput.value;

        const childResourceName = this.#childResourceSelect.value || "";
        const metaAttrs = this.#metaKVGroup.getFrontendKValues();

        const metaAttrsList = [];
        for (const name in metaAttrs) {
            metaAttrsList.push({ id: `${newID}-meta_attributes-${name}`, name, value: metaAttrs[name] });
        }

        let primitives = [{id: childResourceName}];
        const clone = {
            id: newID,
            childResource: childResourceName,
            primitive: primitives,
            meta_attributes: {
                id: `${newID}-meta_attributes`,
                nvpair: metaAttrsList
            },
        };

        return fetch("/api/cib/clone/create", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clone)
        })
            .then(async res => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || "Unknown error");
                }
                return res.json();
            })
            .then(status => {
                console.log("Create status:", status);
                window.location.href = `/cib/live/clones/${newID}/edit?flash=created`;
            });
    }
}
